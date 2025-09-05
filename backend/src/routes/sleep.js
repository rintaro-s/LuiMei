const express = require('express');
const router = express.Router();
const sleepController = require('../controllers/sleep-controller');
const authMiddleware = require('../middleware/auth');

// アラーム設定
router.post('/alarms', authMiddleware, sleepController.setAlarm);

// アラーム一覧取得
router.get('/alarms', authMiddleware, sleepController.getAlarms);

// アラーム削除
router.delete('/alarms/:alarmId', authMiddleware, sleepController.deleteAlarm);

// 睡眠記録
router.post('/records', authMiddleware, sleepController.recordSleep);

// 睡眠データ取得
router.get('/data', authMiddleware, sleepController.getSleepData);

// 寝坊対応
router.post('/oversleep', authMiddleware, sleepController.handleOversleep);

module.exports = router;
