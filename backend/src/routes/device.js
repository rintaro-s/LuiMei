const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device-controller');

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

module.exports = router;
