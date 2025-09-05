const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar-controller');
const authMiddleware = require('../middleware/auth');

// 今日の予定取得
router.get('/today', authMiddleware, calendarController.getTodayEvents);

// 週間予定取得
router.get('/week', authMiddleware, calendarController.getWeeklyEvents);

// イベント作成
router.post('/events', authMiddleware, calendarController.createEvent);

// 進捗確認
router.post('/progress', authMiddleware, calendarController.checkProgress);

module.exports = router;
