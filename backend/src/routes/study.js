const express = require('express');
const router = express.Router();
const studyController = require('../controllers/study-controller');
const authMiddleware = require('../middleware/auth');

// 学習素材分析（カメラ）
router.post('/analyze', authMiddleware, studyController.analyzeStudyMaterial);

// 学習進捗記録
router.post('/progress', authMiddleware, studyController.recordStudyProgress);

// 学習セッション開始
router.post('/sessions/start', authMiddleware, studyController.startStudySession);

// 学習セッション終了
router.post('/sessions/end', authMiddleware, studyController.endStudySession);

// 学習統計取得
router.get('/stats', authMiddleware, studyController.getStudyStats);

// 学習アドバイス取得
router.get('/advice', authMiddleware, studyController.getStudyAdvice);

module.exports = router;
