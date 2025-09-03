const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat-controller');

// Send message to AI
router.post('/message', chatController.sendMessage);

// Get chat history
router.get('/history/:userId', chatController.getChatHistory);

// Search chat history
router.get('/search/:userId', chatController.searchChatHistory);

// Clear chat history
router.delete('/history/:userId', chatController.clearChatHistory);

module.exports = router;
