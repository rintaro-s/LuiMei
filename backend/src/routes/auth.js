const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/auth-controller');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('displayName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name is required and must be less than 100 characters'),
  body('personality.mode')
    .optional()
    .isIn(['friendly', 'professional', 'casual', 'energetic', 'calm', 'custom'])
    .withMessage('Invalid personality mode'),
  body('preferences.language')
    .optional()
    .isIn(['ja', 'en', 'zh', 'ko'])
    .withMessage('Invalid language preference'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Invalid theme preference')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Public routes (no authentication required)

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, password, displayName, personality?, preferences?, privacy?, deviceInfo? }
 */
router.post('/register', validateRegistration, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password, deviceInfo? }
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh', validateRefreshToken, authController.refreshToken);

// Protected routes (authentication required)

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authController.requireAuth, authController.getProfile);

/**
 * @route   GET /api/auth/devices
 * @desc    Get user's registered devices
 * @access  Private
 */
router.get('/devices', authController.requireAuth, authController.getDevices);

/**
 * @route   POST /api/auth/devices
 * @desc    Register a new device
 * @access  Private
 * @body    { deviceId, deviceName, deviceType, platform, capabilities? }
 */
router.post('/devices', authController.requireAuth, authController.registerDevice);

/**
 * @route   DELETE /api/auth/devices/:deviceId
 * @desc    Remove a device
 * @access  Private
 */
router.delete('/devices/:deviceId', authController.requireAuth, authController.removeDevice);

module.exports = router;
