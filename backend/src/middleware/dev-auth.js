/**
 * Development Authentication Middleware
 * 開発環境用の認証バイパス
 */

const devAuthMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    // 開発環境では模擬ユーザーを設定
    req.user = {
      userId: 'dev_user_001',
      email: 'developer@lumimei.com',
      name: 'Development User'
    };
  }
  next();
};

module.exports = devAuthMiddleware;
