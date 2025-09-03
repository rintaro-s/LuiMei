const express = require('express');
const router = express.Router();
const contextController = require('../controllers/context-controller');
const { requireAuth } = require('../controllers/auth-controller');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Context management endpoints
router.post('/update', contextController.updateContext);
router.get('/:userId', contextController.getContext);

module.exports = router;
