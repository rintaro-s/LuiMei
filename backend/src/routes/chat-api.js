const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat-controller');
const { validateRequest } = require('../middleware/validation');
const { requireAuth } = require('../controllers/auth-controller');

// Chat endpoint (client.py compatible)
router.post('/chat', requireAuth, validateRequest('chatSchema'), chatController.processChat);

// Alternative REST-style endpoints
router.post('/message', requireAuth, validateRequest('messageSchema'), chatController.sendMessage);
router.get('/history', requireAuth, chatController.getChatHistory);
router.post('/history/search', requireAuth, chatController.searchChatHistory);
router.delete('/history', requireAuth, chatController.clearChatHistory);

// Memory management
router.get('/memory/compressed', requireAuth, chatController.getCompressedMemory);
router.post('/memory/compress', requireAuth, chatController.compressMemory);
router.delete('/memory', requireAuth, chatController.clearMemory);

module.exports = router;
