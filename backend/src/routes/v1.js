/**
 * LumiMei OS v1 API Routes
 * 新API仕様に対応したルート定義
 */

const express = require('express');
const router = express.Router();

// Controllers
const assistantController = require('../controllers/assistant-controller');
const assistantExt = require('../controllers/assistant-extended-controller');
const contextController = require('../controllers/context-controller');
const memoryController = require('../controllers/memory-controller');
const visionController = require('../controllers/vision-controller');
const deviceController = require('../controllers/device-controller');
const userController = require('../controllers/user-controller');
const statusController = require('../controllers/status-controller');
const { requireAuth } = require('../controllers/auth-controller');

// Apply authentication middleware to all v1 routes
router.use(requireAuth);

// 1) Assistant API - 対話＋TTS統合応答
router.post('/assistant/reply', assistantController.reply);

// Session start
router.post('/assistant/session', assistantExt.startSession);

// Tools (function registration)
router.get('/assistant/tools', assistantExt.listTools);

// TTS direct
router.get('/tts', assistantExt.getTTS);

// Wakeword suggestions
router.post('/assistant/wakeword/suggest', assistantExt.suggestWakewords);

// 3) Wakeword API - ウェイクワードモデル配布
router.get('/assistant/wakeword', assistantController.getWakewordModel);
router.get('/assistant/wakeword/manifest', assistantController.getWakewordManifest);

// 4) Context API - コンテキスト・プレゼンス更新
router.post('/context/update', contextController.updateContext);
router.get('/context/:userId', contextController.getContext);

// 5) Memory API - メモリ検索・参照
router.post('/memory/query', memoryController.queryMemory);
router.post('/memory/store', memoryController.storeMemory);
router.get('/memory/:memoryId', memoryController.getMemory);

// 6) Device API - デバイス列挙・コマンド
router.get('/devices/list', deviceController.listDevices);
router.post('/devices/command', deviceController.executeCommand);
router.get('/devices/:deviceId/capabilities', deviceController.getCapabilities);

// 7) Vision API - 視覚処理
router.post('/vision/analyze', visionController.analyzeVision);
router.post('/vision/batch', visionController.analyzeBatch);

// History (store / query)
router.get('/assistant/history', assistantExt.queryHistory);
router.post('/assistant/history', assistantExt.storeHistory);

// STT async upload/job
router.post('/stt/async', assistantExt.createSttJob);
router.get('/stt/async/:jobId', assistantExt.getSttJob);

// User profile & voices
router.get('/users/:id/profile', userController.getProfile);
router.get('/voices', userController.listVoices);

// Status
router.get('/status', statusController.getStatus);

// Health check for v1 API
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    apis: [
      'assistant',
      'context', 
      'memory',
      'devices',
      'vision'
    ]
  });
});

module.exports = router;
