const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device-controller');
const authMiddleware = require('../middleware/auth');

// Get all discovered devices
router.get('/discover', deviceController.discoverDevices);

// Get device status
router.get('/:deviceId/status', deviceController.getDeviceStatus);

// Send command to device
router.post('/:deviceId/command', deviceController.sendCommand);

// Get device capabilities
router.get('/:deviceId/capabilities', deviceController.getCapabilities);

// Device registration
router.post('/register', deviceController.registerDevice);

// Device unregistration
router.delete('/:deviceId', deviceController.unregisterDevice);

// 新機能: スマホ設定制御
router.post('/phone/settings', authMiddleware, deviceController.controlPhoneSettings);

// 新機能: LINEメッセージ送信
router.post('/line/message', authMiddleware, deviceController.sendLineMessage);

// 新機能: Discordメッセージ送信
router.post('/discord/message', authMiddleware, deviceController.sendDiscordMessage);

// 新機能: 統合アクション実行
router.post('/integrated/action', authMiddleware, deviceController.executeIntegratedAction);

module.exports = router;
