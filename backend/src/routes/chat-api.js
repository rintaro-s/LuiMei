const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat-controller');
const { validateRequest } = require('../middleware/validation');
const { requireAuth } = require('../controllers/auth-controller');
const devAuthMiddleware = require('../middleware/dev-auth');

// Chat endpoint (client.py compatible)
router.post('/chat', requireAuth, validateRequest('chatSchema'), chatController.processChat);

// Accept legacy clients posting to /chat/message with either { message } or { text }
router.post('/message', (req, res, next) => {
	// Normalize older payload shapes: if body has `text` but not `message`, map it
	try {
		if (!req.body) req.body = {};
		if (typeof req.body.message === 'undefined' && typeof req.body.text === 'string') {
			req.body.message = req.body.text;
		}
	} catch (e) { /* ignore */ }
	next();
}, (process.env.NODE_ENV === 'development' ? devAuthMiddleware : requireAuth), validateRequest('messageSchema'), chatController.sendMessage);

// Alternative REST-style endpoints
// (previous route replaced by normalized handler above)
router.get('/history', requireAuth, chatController.getChatHistory);
router.post('/history/search', requireAuth, chatController.searchChatHistory);
router.delete('/history', requireAuth, chatController.clearChatHistory);

// Memory management
router.get('/memory/compressed', requireAuth, chatController.getCompressedMemory);
router.post('/memory/compress', requireAuth, chatController.compressMemory);
router.delete('/memory', requireAuth, chatController.clearMemory);

module.exports = router;
