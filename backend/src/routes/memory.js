const express = require('express');
const router = express.Router();
const memoryController = require('../controllers/memory-controller');
const { requireAuth } = require('../controllers/auth-controller');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Memory management endpoints
router.post('/query', memoryController.queryMemory);
router.post('/store', memoryController.storeMemory);
router.get('/:memoryId', memoryController.getMemory);

module.exports = router;
