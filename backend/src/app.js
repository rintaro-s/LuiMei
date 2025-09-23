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
const { writeErrorLog, ERROR_LOG_PATH } = require('./utils/error-logger');

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
// Configure CORS origins from environment (comma separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    // Allow subdomain/ngrok host patterns
    try {
      const url = new URL(origin);
      if (allowedOrigins.indexOf(url.origin) !== -1) return callback(null, true);
    } catch (e) { /* ignore */ }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
// Access logger
const accessLogger = require('./middleware/access-logger');
app.use(accessLogger());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Development: shallow request logger to capture request bodies for debugging
if (process.env.NODE_ENV === 'development') {
  try {
    const requestLogger = require('./utils/request-logger');
    app.use(requestLogger);
    console.log('ℹ️  Request logger enabled (development only)');
  } catch (e) { console.warn('Could not enable request logger:', e && e.message ? e.message : e); }
}

// Health check endpoint (always available)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// NOTE: 404 handler will be registered after routes during startup (see startServer)

// Start-up sequence: connect to MongoDB first, then initialize passport, routes and socket handlers.
async function startServer() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lumimei_os';
  const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
    // Keep default buffering behavior for safety during startup if connection is slow
    bufferCommands: false
  };

  let dbConnected = false;
  try {
    await mongoose.connect(mongoUri, mongoOptions);
    console.log('📊 Connected to MongoDB');
    dbConnected = true;
  } catch (err) {
    console.log('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Server will continue without database functionality');
    // As a fallback to avoid "Cannot call ... before initial connection is complete" errors,
    // enable mongoose command buffering so model calls don't immediately throw while the DB is down.
    try {
      mongoose.set('bufferCommands', true);
      console.log('ℹ️  Enabled mongoose bufferCommands as fallback');
    } catch (e) { /* ignore */ }
  }

  // Load passport configuration only after we've had a chance to configure mongoose buffering or connect
  try {
    require('./config/passport');
    app.use(passport.initialize());
  } catch (e) {
    console.error('Failed to initialize passport:', e && e.message ? e.message : e);
  }

  // Routes (register after passport is initialized)
  app.use('/auth', require('./routes/auth'));
  // Backwards-compatible mount for clients expecting /api/auth/*
  app.use('/api/auth', require('./routes/auth'));
  // Compatibility mounts: allow older clients to call routes without /api prefix
  app.use('/communication', require('./routes/communication'));
  app.use('/chat', require('./routes/chat-api'));
  app.use('/ai', require('./routes/ai'));
  // Legacy compatibility mounts for older clients
  app.use('/life', require('./routes/life'));
  app.use('/study', require('./routes/study'));
  // Also accept very short legacy endpoints at server root for some clients
  // Some older clients POST to /study/start and /study/end directly without the router prefix.
  // Forward those directly to the StudyController handlers so they behave the same as the
  // '/study' compatibility router above.
  try {
    const StudyController = require('./controllers/study-controller');
    const studyController = new StudyController();
    app.post('/study/start', (req, res) => studyController.startStudySession(req, res));
    app.post('/study/end', (req, res) => studyController.endStudySession(req, res));
  } catch (e) {
    console.warn('Could not register short study endpoints:', e && e.message ? e.message : e);
  }
  app.use('/api/users', require('./routes/user'));
  app.use('/api/chat', require('./routes/chat-api'));
  app.use('/api/devices', require('./routes/device'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/communication', require('./routes/communication'));
  app.use('/api/tasks', require('./routes/task'));
  app.use('/api/v1', require('./routes/v1')); // New v1 API routes

  // Compatibility route: accept POST /api/tts from Android clients and forward to TTS controller
  app.post('/api/tts', (req, res) => require('./controllers/tts-controller').synthesizeSpeech(req, res));

  // Setup Socket.IO handlers
  try {
    const { setupSocketHandlers } = require('./socket/handlers');
    setupSocketHandlers(io);
  } catch (e) {
    console.error('Failed to setup socket handlers:', e && e.message ? e.message : e);
  }

  // 404 handler (registered after routes)
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`
    });
  });

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 LumiMei OS Server running on port ${PORT}`);
    console.log(`📚 Health check: http://localhost:${PORT}/health`);
    console.log(`🔌 Socket.IO ready for client connections`);
    // VOSK model check
    try {
      const modelPath = process.env.VOSK_MODEL_PATH || require('path').resolve(process.cwd(), 'vosk-model-ja-0.22');
      if (!require('fs').existsSync(modelPath)) {
        console.warn('⚠️  VOSK model not found at', modelPath, '\n   Please download and place the model in the project root or set VOSK_MODEL_PATH in .env');
      } else {
        console.log('✅ VOSK model found at', modelPath);
      }
    } catch (e) { /* ignore */ }
  });
}

// Kick off start-up
startServer();

// Global error handlers to capture uncaught errors and unhandled rejections
process.on('uncaughtException', (err) => {
  try {
    console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
    writeErrorLog({ level: 'uncaughtException', error: err && err.stack ? err.stack : String(err) });
  } catch (e) { console.error('Failed to write uncaughtException to error log', e && e.message ? e.message : e); }
  // Do not exit immediately in dev; allow supervisor to handle process lifecycle
});

process.on('unhandledRejection', (reason, promise) => {
  try {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    writeErrorLog({ level: 'unhandledRejection', reason: reason && reason.stack ? reason.stack : String(reason) });
  } catch (e) { console.error('Failed to write unhandledRejection to error log', e && e.message ? e.message : e); }
});

// Express error handling middleware (ensure this is last middleware)
app.use((err, req, res, next) => {
  try {
    console.error('Express error:', err && err.stack ? err.stack : err);
    writeErrorLog({ level: 'express', path: req.originalUrl, method: req.method, error: err && err.stack ? err.stack : String(err) });
  } catch (e) { console.error('Failed to write express error to error log', e && e.message ? e.message : e); }
  // If headers already sent, delegate to default handler
  if (res.headersSent) return next(err);
  res.status(err && err.status ? err.status : 500).json({ success: false, error: err && err.message ? err.message : 'Internal Server Error' });
});

module.exports = app;
