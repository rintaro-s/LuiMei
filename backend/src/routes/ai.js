const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth-controller');
const chatController = require('../controllers/chat-controller');

// AI Chat endpoints - client.py compatible
router.post('/chat', authController.requireAuth, chatController.processChat);

// AI model management
router.get('/models', authController.requireAuth, (req, res) => {
  res.json({
    success: true,
    models: [
      {
        id: 'lumimei-core-v1',
        name: 'LumiMei Core v1.0',
        description: 'Core AI personality model',
        capabilities: ['text_generation', 'emotion_analysis', 'personality_adaptation'],
        status: 'active'
      }
    ]
  });
});

// AI configuration
router.get('/config', authController.requireAuth, (req, res) => {
  res.json({
    success: true,
    config: {
      maxTokens: 2000,
      temperature: 0.7,
      personalityEnabled: true,
      memoryEnabled: true,
      emotionAnalysisEnabled: true
    }
  });
});

// AI status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
