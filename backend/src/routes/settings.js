const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings-controller');
const authMiddleware = require('../middleware/auth');

// 全設定取得
router.get('/', authMiddleware, settingsController.getAllSettings);

// 設定更新
router.post('/update', authMiddleware, settingsController.updateSettings);

// 設定リセット
router.post('/reset', authMiddleware, settingsController.resetSettings);

// 設定エクスポート
router.get('/export', authMiddleware, settingsController.exportSettings);

// 設定インポート
router.post('/import', authMiddleware, settingsController.importSettings);

module.exports = router;
