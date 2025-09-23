const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/auth-controller');

const router = express.Router();

// Validation middleware (define before using in routes)
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

// Accept either `refresh` or `refreshToken` in request body for compatibility
const validateRefreshToken = [
  (req, res, next) => {
    if (!req.body) return res.status(400).json({ success: false, error: 'Refresh token required' });
    if (!req.body.refresh && !req.body.refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }
    next();
  }
];

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
}));

router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/auth/failure',
    session: false 
  }),
  async (req, res) => {
    try {
      const user = req.user;
      // Generate server tokens (access + refresh) using auth controller helper
      const tokens = authController.generateTokens(user.userId || user._id, {
        email: user.email,
        displayName: user.displayName
      });

      // Persist tokens to user record for server-side integrations
      if (user.updateAccessToken) {
        try { await user.updateAccessToken(tokens.accessToken, tokens.refreshToken); } catch(e) { /* ignore persist errors */ }
      } else {
        user.accessToken = tokens.accessToken;
        user.refreshToken = tokens.refreshToken;
        try { await user.save(); } catch(e) { /* ignore */ }
      }

      // Prepare deep link including both tokens (client can prefer accessToken)
      const callbackUrl = process.env.MOBILE_APP_CALLBACK_URL || 'meimi://auth/callback';
  // URL-encode tokens to ensure the deep link is safe
  const deepLink = `${callbackUrl}?access=${encodeURIComponent(tokens.accessToken)}&refresh=${encodeURIComponent(tokens.refreshToken)}&success=true`;

      // If the requester accepts HTML (typical browser), render a fallback page that tries to open the deep link
      const accept = (req.headers['accept'] || '').toLowerCase();
      if (accept.includes('text/html')) {
        const html = `<!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Authentication Complete</title>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial;padding:20px}</style>
        </head>
        <body>
          <h2>ログインが完了しました</h2>
          <p>アプリが自動で開かない場合は、下のリンクをタップまたはコピーしてアプリに貼り付けてください。</p>
          <p><a id="open" href="${deepLink}">アプリで開く</a></p>
          <p>Access Token (use this in Authorization: Bearer &lt;token&gt;):</p>
          <pre id="token" style="word-break:break-all;padding:10px;background:#f6f8fa;border:1px solid #e1e4e8">${tokens.accessToken}</pre>
          <p>Refresh Token:</p>
          <pre style="word-break:break-all;padding:10px;background:#f6f8fa;border:1px solid #e1e4e8">${tokens.refreshToken}</pre>
          <script>
            // Try to open the deep link once (mobile browsers usually allow)
            setTimeout(function(){ window.location = '${deepLink}'; }, 200);
          </script>
        </body>
        </html>`;
        return res.status(200).send(html);
      }

      // Otherwise perform a normal redirect (used by non-browser clients)
      res.redirect(deepLink);
    } catch (error) {
      console.error('OAuth callback error:', error && error.stack ? error.stack : error);
      try { const { writeErrorLog } = require('../utils/error-logger'); writeErrorLog({ level: 'oauth_callback', error: error && error.stack ? error.stack : String(error), path: req.originalUrl, method: req.method }); } catch(e) { /* ignore */ }
      res.redirect('/auth/failure');
    }
  }
);

// Success callback for web clients
router.get('/success', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    user: req.user ? req.user.getPublicProfile() : null
  });
});

// Failure callback
router.get('/failure', (req, res) => {
  res.json({
    success: false,
    message: 'Authentication failed',
    error: 'OAuth authentication was unsuccessful'
  });
});

// OAuth logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find and update user status
    const User = require('../models/User');
    const user = await User.findOne({ userId: decoded.userId });
    if (user) {
      user.status = user.status || {};
      user.status.isOnline = false;
      user.status.lastActiveAt = new Date();
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout',
      error: error.message
    });
  }
});

// Legacy auth routes (for backwards compatibility)
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh', validateRefreshToken, authController.refreshToken);

// Protected routes (authentication required)
router.get('/profile', authController.requireAuth, authController.getProfile);
router.get('/devices', authController.requireAuth, authController.getDevices);
router.post('/devices', authController.requireAuth, authController.registerDevice);
router.delete('/devices/:deviceId', authController.requireAuth, authController.removeDevice);

module.exports = router;
