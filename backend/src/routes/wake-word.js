const express = require('express');
const router = express.Router();
const wakeWordController = require('../controllers/wake-word-controller');
const authMiddleware = require('../middleware/auth');

// ウェイクワード設定取得
router.get('/settings', authMiddleware, wakeWordController.getWakeWordSettings);

// ウェイクワード設定更新
router.post('/settings', authMiddleware, wakeWordController.updateWakeWordSettings);

// ウェイクワード検出処理
router.post('/detect', authMiddleware, wakeWordController.processWakeWordDetection);

module.exports = router;
