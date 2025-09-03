const express = require('express');
const router = express.Router();

// Import route modules
const chatRoutes = require('./chat');
const deviceRoutes = require('./device');
const userRoutes = require('./user');
const aiRoutes = require('./ai');
const taskRoutes = require('./task');

// Route definitions
router.use('/chat', chatRoutes);
router.use('/device', deviceRoutes);
router.use('/user', userRoutes);
router.use('/ai', aiRoutes);
router.use('/task', taskRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'LumiMei OS API',
    version: '1.0.0',
    description: 'Personal AI Infrastructure API',
    endpoints: {
      chat: '/api/v1/chat',
      device: '/api/v1/device',
      user: '/api/v1/user',
      ai: '/api/v1/ai',
      task: '/api/v1/task'
    }
  });
});

module.exports = router;
