const express = require('express');
const router = express.Router();
const StudyController = require('../controllers/study-controller');
const authMiddleware = require('../middleware/auth');

// StudyControllerのインスタンスを作成
const studyController = new StudyController();

// 学習素材分析（カメラ）
router.post('/analyze', authMiddleware, (req, res) => studyController.analyzeStudyMaterial(req, res));

// 学習進捗記録
router.post('/progress', authMiddleware, (req, res) => studyController.recordStudyProgress(req, res));

// 学習セッション開始
router.post('/sessions/start', authMiddleware, (req, res) => studyController.startStudySession(req, res));

// 学習セッション終了
router.post('/sessions/end', authMiddleware, (req, res) => studyController.endStudySession(req, res));

// 学習セッション一覧取得
router.get('/sessions', authMiddleware, (req, res) => studyController.getStudySessions(req, res));

// 学習統計取得
router.get('/stats', authMiddleware, (req, res) => studyController.getStudyStats(req, res));

// 学習アドバイス取得
router.get('/advice', authMiddleware, (req, res) => studyController.getStudyAdvice(req, res));

module.exports = router;
