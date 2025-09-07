const express = require('express');
const router = express.Router();

// Controllers
const assistantController = require('../controllers/assistant-controller');
const assistantExt = require('../controllers/assistant-extended-controller');
const contextController = require('../controllers/context-controller');
const memoryController = require('../controllers/memory-controller');
const visionController = require('../controllers/vision-controller');
const visionApiController = require('../controllers/vision-api-controller');
const deviceController = require('../controllers/device-controller');
const userController = require('../controllers/user-controller');
const statusController = require('../controllers/status-controller');
const communicationController = require('../controllers/communication-controller');
const wakeWordController = require('../controllers/wake-word-controller');
const sleepController = require('../controllers/sleep-controller');
const StudyController = require('../controllers/study-controller');
const LifeAssistantController = require('../controllers/life-assistant-controller');
const ttsController = require('../controllers/tts-controller');
const settingsController = require('../controllers/settings-controller');
const { requireAuth } = require('../controllers/auth-controller');
const devAuthMiddleware = require('../middleware/dev-auth');

// インスタンス作成
const studyController = new StudyController();
const lifeAssistantController = new LifeAssistantController();

// Public monitoring endpoints (no auth)
router.get('/status', (req, res, next) => {
  // Expose basic status without requiring authentication for monitoring
  req.user = { userId: 'system' };
  next();
}, statusController.getStatus);

// Health check for v1 API (public)
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

// Apply authentication middleware to remaining v1 routes
// Skip auth in development environment
if (process.env.NODE_ENV !== 'development') {
  router.use(requireAuth);
} else {
  console.log('🔓 Authentication disabled in development mode');
  router.use(devAuthMiddleware); // 開発環境では模擬ユーザーを設定
}

// CLIENT COMPATIBLE ENDPOINTS

// Communication API - main message endpoint
router.post('/communication/message', communicationController.sendMessage);
router.post('/communication/voice/input', communicationController.handleVoiceInput);
router.get('/communication/voice/output/:messageId', communicationController.getVoiceOutput);
router.post('/communication/command/device', communicationController.executeDeviceCommand);
router.get('/communication/command/:commandId/status', communicationController.getCommandStatus);

// Communication session & context
router.post('/communication/session/start', communicationController.startSession);
router.post('/communication/session/end', communicationController.endSession);
router.get('/communication/session/:sessionId/status', communicationController.getSessionStatus);
router.get('/communication/context/:userId', communicationController.getContext);
router.post('/communication/context/update', communicationController.updateContext);

// Vision API - image analysis
router.post('/vision/analyze', visionApiController.analyzeImage);
router.post('/communication/vision/analyze', communicationController.analyzeImage);

// TTS - Text to Speech
router.post('/communication/tts/speak', (req, res) => ttsController.synthesizeSpeech(req, res));
router.post('/communication/tts/stream', ttsController.streamSpeech);
router.get('/voices', ttsController.getAvailableVoices);

// Wake Word API
router.get('/wake-word/settings', wakeWordController.getWakeWordSettings);
router.post('/wake-word/settings', wakeWordController.updateWakeWordSettings);
router.post('/wake-word/detect', wakeWordController.processWakeWordDetection);

// Sleep & Alarm API
router.post('/sleep/alarms', sleepController.setAlarm);
router.get('/sleep/alarms', sleepController.getAlarms);
router.delete('/sleep/alarms/:alarmId', sleepController.deleteAlarm);
router.post('/sleep/records', sleepController.recordSleep);
router.get('/sleep/data', sleepController.getSleepData);
router.post('/sleep/oversleep', sleepController.handleOversleep);

// Study Assistant API
router.post('/study/analyze', (req, res) => studyController.analyzeStudyMaterial(req, res));
router.post('/study/progress', (req, res) => studyController.recordStudyProgress(req, res));
router.get('/study/sessions', (req, res) => studyController.getStudySessions(req, res));
router.post('/study/sessions/start', (req, res) => studyController.startStudySession(req, res));
router.post('/study/sessions/end', (req, res) => studyController.endStudySession(req, res));
router.get('/study/stats', (req, res) => studyController.getStudyStats(req, res));
router.get('/study/advice', (req, res) => studyController.getStudyAdvice(req, res));

// Life Assistant API - 生活の手助け機能
router.get('/life/shopping', (req, res) => lifeAssistantController.getShoppingList(req, res));
router.post('/life/shopping', (req, res) => lifeAssistantController.addShoppingItem(req, res));
router.get('/life/cooking', (req, res) => lifeAssistantController.getCookingSuggestions(req, res));
router.get('/life/cleaning', (req, res) => lifeAssistantController.getCleaningSchedule(req, res));
router.get('/life/expenses', (req, res) => lifeAssistantController.getExpenseTracking(req, res));
router.get('/life/tips', (req, res) => lifeAssistantController.getLifeTips(req, res));

// AI Powered Convenience Features
router.post('/life/smart-suggestions', (req, res) => lifeAssistantController.getSmartSuggestions(req, res));

// Expense tracking endpoints (家計簿機能)
router.get('/expenses/:userId', (req, res) => lifeAssistantController.getExpenses(req, res));
router.post('/expenses', (req, res) => lifeAssistantController.addExpense(req, res));
router.delete('/expenses/:id', (req, res) => lifeAssistantController.deleteExpense(req, res));

// Device list endpoint
router.get('/devices/list', deviceController.listDevices);
router.post('/devices/command', deviceController.executeCommand);
router.get('/devices/:deviceId/capabilities', deviceController.getCapabilities);

// Device control and messaging (protected by auth middleware)
router.post('/device/phone/settings', deviceController.controlPhoneSettings);
router.post('/device/line/message', deviceController.sendLineMessage);
router.post('/device/discord/message', deviceController.sendDiscordMessage);
router.post('/device/integrated/action', deviceController.executeIntegratedAction);

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

// Settings management
router.get('/settings', devAuthMiddleware, settingsController.getAllSettings);
router.post('/settings/update', devAuthMiddleware, settingsController.updateSettings);
router.post('/settings/reset', devAuthMiddleware, settingsController.resetSettings);
router.get('/settings/export', devAuthMiddleware, settingsController.exportSettings);
router.post('/settings/import', devAuthMiddleware, settingsController.importSettings);

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
      'vision',
      'settings'
    ]
  });
});

module.exports = router;
