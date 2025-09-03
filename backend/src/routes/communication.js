const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication-controller');
const authController = require('../controllers/auth-controller');

// Apply authentication middleware to all routes
router.use(authController.requireAuth);

// Real-time communication events
router.post('/message', communicationController.sendMessage);

// Voice communication
router.post('/voice/input', communicationController.handleVoiceInput);
router.get('/voice/output/:messageId', communicationController.getVoiceOutput);

// Vision/Image processing
router.post('/vision/analyze', communicationController.analyzeImage);

// Context management
router.post('/context/update', communicationController.updateContext);
router.get('/context/:userId', communicationController.getContext);

// Session management
router.post('/session/start', communicationController.startSession);
router.post('/session/end', communicationController.endSession);
router.get('/session/:sessionId/status', communicationController.getSessionStatus);

// Device integration commands
router.post('/command/device', communicationController.executeDeviceCommand);
router.get('/command/:commandId/status', communicationController.getCommandStatus);

module.exports = router;
