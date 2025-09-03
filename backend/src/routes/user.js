const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth-controller');

// User profile management
router.get('/profile', authController.requireAuth, authController.getProfile);

// User devices
router.get('/devices', authController.requireAuth, authController.getDevices);

module.exports = router;
