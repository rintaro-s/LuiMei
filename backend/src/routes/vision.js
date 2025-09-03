const express = require('express');
const router = express.Router();
const visionController = require('../controllers/vision-controller');
const { requireAuth } = require('../controllers/auth-controller');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Vision analysis endpoints
router.post('/analyze', visionController.analyzeVision);
router.post('/batch', visionController.analyzeBatch);

module.exports = router;
