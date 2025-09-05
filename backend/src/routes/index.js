const express = require('express');
const router = express.Router();

// Import route modules
const chatRoutes = require('./chat');
const deviceRoutes = require('./device');
const userRoutes = require('./user');
const aiRoutes = require('./ai');
const taskRoutes = require('./task');
const wakeWordRoutes = require('./wake-word');
const calendarRoutes = require('./calendar');
const sleepRoutes = require('./sleep');
const studyRoutes = require('./study');

// Route definitions
router.use('/chat', chatRoutes);
router.use('/device', deviceRoutes);
router.use('/user', userRoutes);
router.use('/ai', aiRoutes);
router.use('/task', taskRoutes);
router.use('/wake-word', wakeWordRoutes);
router.use('/calendar', calendarRoutes);
router.use('/sleep', sleepRoutes);
router.use('/study', studyRoutes);

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
      task: '/api/v1/task',
      wakeWord: '/api/v1/wake-word',
      calendar: '/api/v1/calendar',
      sleep: '/api/v1/sleep',
      study: '/api/v1/study'
    }
  });
});

module.exports = router;
