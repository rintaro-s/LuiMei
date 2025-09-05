const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const passport = require('passport');

// Load environment variables early so other modules (eg. passport) can read them
const path = require('path');
// Prefer backend/.env (this app runs from repo root via npm start); fallback to default .env
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });
console.log('Loaded environment from', envPath);

// Load passport configuration
require('./config/passport');

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "meimi://auth"],
    methods: ['GET', 'POST'],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true
  }
});

// Socket.IO authentication middleware
const fs = require('fs');
// 'path' is already required above for env loading
const LOG_PATH = process.env.ACCESS_LOG_PATH || require('path').join(__dirname, '..', '..', 'logs', 'access.log');

function ensureLogDir() {
  try {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) { /* ignore */ }
}

function maskToken(auth) {
  if (!auth) return null;
  try {
    if (auth.startsWith && auth.startsWith('Bearer ')) {
      const t = auth.slice(7).trim();
      if (t.length <= 12) return 'Bearer ' + t;
      return 'Bearer ' + t.slice(0, 8) + '...' + t.slice(-8);
    }
    if (auth.length <= 12) return auth;
    return auth.slice(0, 8) + '...' + auth.slice(-8);
  } catch (e) { return auth; }
}

function writeAuthLog(entry) {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_PATH, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, entry)) + '\n');
  } catch (e) { console.log('[socket-auth-logger] write error', e.message); }
}

io.use((socket, next) => {
  try {
    const auth = socket.handshake?.auth || {};
    const headers = socket.handshake?.headers || {};
    const query = socket.handshake?.query || {};
    // priority: auth.accessToken -> headers.authorization -> query.token
    let token = auth.accessToken || auth.token || headers.authorization || query.token || '';
    // if header contains 'Bearer ', keep it as-is so maskToken handles it
    if (headers.authorization && !token.startsWith('Bearer ')) token = headers.authorization;

    if (!token || token === '') {
      const entry = { remote: socket.handshake.address || socket.conn?.remoteAddress || '-', method: 'SOCKET_CONNECT', path: socket.nsp && socket.nsp.name ? socket.nsp.name : '/', reason: token === '' ? 'EMPTY' : 'MISSING', authorization: maskToken(token) };
      writeAuthLog(entry);
      return next(new Error('Authentication required'));
    }

    // attach masked token info to socket for downstream use if needed
    socket.authToken = token;
    return next();
  } catch (err) {
    console.error('Socket auth middleware error', err);
    return next(new Error('Authentication required'));
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
// Access logger
const accessLogger = require('./middleware/access-logger');
app.use(accessLogger());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize passport
app.use(passport.initialize());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Routes
app.use('/auth', require('./routes/auth'));
// Backwards-compatible mount for clients expecting /api/auth/*
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/chat', require('./routes/chat-api'));
app.use('/api/devices', require('./routes/device'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/communication', require('./routes/communication'));
app.use('/api/tasks', require('./routes/task'));
app.use('/api/v1', require('./routes/v1')); // New v1 API routes

// Setup Socket.IO handlers
const { setupSocketHandlers } = require('./socket/handlers');
setupSocketHandlers(io);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Connect to MongoDB (non-blocking)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lumimei_os', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
  bufferCommands: false
}).then(() => {
  console.log('📊 Connected to MongoDB');
}).catch(err => {
  console.log('❌ MongoDB connection error:', err.message);
  console.log('⚠️  Server will continue without database functionality');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 LumiMei OS Server running on port ${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.IO ready for client connections`);
});

module.exports = app;
