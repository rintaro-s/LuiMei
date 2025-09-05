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
const calendarController = require('../controllers/calendar-controller');
const wakeWordController = require('../controllers/wake-word-controller');
const sleepController = require('../controllers/sleep-controller');
const studyController = require('../controllers/study-controller');
const ttsController = require('../controllers/tts-controller');
const { requireAuth } = require('../controllers/auth-controller');

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
router.use(requireAuth);

// CLIENT COMPATIBLE ENDPOINTS

// Communication API - main message endpoint
router.post('/communication/message', communicationController.sendMessage);
router.post('/communication/voice/input', communicationController.handleVoiceInput);
router.post('/communication/command/device', communicationController.executeDeviceCommand);

// Vision API - image analysis
router.post('/vision/analyze', visionApiController.analyzeImage);
router.post('/communication/vision/analyze', communicationController.analyzeImage);

// TTS - Text to Speech
router.post('/communication/tts/speak', ttsController.synthesizeSpeech);
router.post('/communication/tts/stream', ttsController.streamSpeech);
router.get('/voices', ttsController.getAvailableVoices);

// Calendar API - Google Calendar integration
router.get('/calendar/today', calendarController.getTodayEvents);
router.get('/calendar/week', calendarController.getWeeklyEvents);
router.post('/calendar/events', calendarController.createEvent);
router.get('/calendar/progress', calendarController.checkProgress);

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
router.post('/study/analyze', studyController.analyzeStudyMaterial);
router.post('/study/progress', studyController.recordStudyProgress);
router.post('/study/sessions/start', studyController.startStudySession);
router.post('/study/sessions/end', studyController.endStudySession);
router.get('/study/stats', studyController.getStudyStats);
router.get('/study/advice', studyController.getStudyAdvice);

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
