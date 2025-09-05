const authController = require('../controllers/auth-controller');

// Simple wrapper to expose requireAuth as middleware via require('../middleware/auth')
module.exports = async function requireAuth(req, res, next) {
  return authController.requireAuth(req, res, next);
};
