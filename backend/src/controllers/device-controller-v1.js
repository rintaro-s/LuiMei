/**
 * LumiMei OS Device Controller - v1 API Compatible
 * デバイス列挙・制御機能
 */

/**
 * Discover available devices (legacy endpoint)
 */
const discoverDevices = async (req, res) => {
  try {
    // Mock device discovery
    const devices = [
      {
        deviceId: 'smart_light_001',
        name: 'Living Room Light',
        type: 'light',
        manufacturer: 'Philips Hue',
        status: 'online',
        capabilities: ['on_off', 'brightness', 'color'],
        lastSeen: new Date().toISOString()
      },
      {
        deviceId: 'smart_speaker_001',
        name: 'Bedroom Speaker',
        type: 'speaker',
        manufacturer: 'Amazon Echo',
        status: 'online',
        capabilities: ['audio_playback', 'volume_control', 'voice_assistant'],
        lastSeen: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      devices,
      count: devices.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Device discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Device discovery failed'
    });
  }
};

/**
 * Get device status (legacy endpoint)
 */
const getDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const mockStatus = {
      deviceId,
      name: 'Living Room Light',
      type: 'light',
      status: 'online',
      properties: {
        power: true,
        brightness: 75,
        color: '#ffffff'
      },
      lastSeen: new Date().toISOString(),
      batteryLevel: null // No battery for this device
    };

    res.status(200).json({
      success: true,
      data: { device: mockStatus }
    });

  } catch (error) {
    console.error('Device status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get device status'
    });
  }
};

/**
 * Send command to device (legacy endpoint)
 */
const sendCommand = async (req, res) => {
  try {
    const { deviceId, command, parameters } = req.body;

    // Mock command execution
    const result = {
      deviceId,
      command,
      parameters,
      status: 'success',
      executedAt: new Date().toISOString(),
      result: `Command ${command} executed successfully`
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Device command error:', error);
    res.status(500).json({
      success: false,
      error: 'Command execution failed'
    });
  }
};

// 6) デバイス列挙・コマンド（v1 API）
const listDevices = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId is required'
        }
      });
    }

    const mockDevices = [
      {
        deviceId: 'living_light',
        name: 'Living Room Light',
        type: 'light',
        status: 'online',
        capabilities: ['turn_on', 'turn_off', 'set_brightness', 'set_color'],
        properties: {
          power: true,
          brightness: 70,
          color: '#ffd080'
        },
        location: 'living_room',
        lastSeen: new Date().toISOString()
      },
      {
        deviceId: 'bedroom_speaker',
        name: 'Bedroom Speaker',
        type: 'speaker',
        status: 'online',
        capabilities: ['play', 'pause', 'stop', 'set_volume'],
        properties: {
          playing: false,
          volume: 50,
          currentTrack: null
        },
        location: 'bedroom',
        lastSeen: new Date(Date.now() - 30000).toISOString()
      },
      {
        deviceId: 'kitchen_camera',
        name: 'Kitchen Camera',
        type: 'camera',
        status: 'offline',
        capabilities: ['capture', 'stream', 'motion_detect'],
        properties: {
          recording: false,
          motionDetection: true
        },
        location: 'kitchen',
        lastSeen: new Date(Date.now() - 300000).toISOString()
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        devices: mockDevices,
        total: mockDevices.length,
        online: mockDevices.filter(d => d.status === 'online').length
      }
    });

  } catch (error) {
    console.error('Device list error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEVICE_ERROR',
        message: 'Failed to list devices'
      }
    });
  }
};

const executeCommand = async (req, res) => {
  try {
    console.log('Device command request:', JSON.stringify(req.body, null, 2));

    const {
      userId,
      deviceId,
      command,
      parameters = {}
    } = req.body;

    // Validate required fields
    if (!userId || !deviceId || !command) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId, deviceId, and command are required'
        }
      });
    }

    // Mock command execution
    const startTime = Date.now();
    
    // Simulate different command types
    let result = {};
    let success = true;

    switch (command) {
      case 'turn_on':
        result = {
          power: true,
          brightness: parameters.brightness || 100,
          color: parameters.color || '#ffffff'
        };
        break;
      
      case 'turn_off':
        result = {
          power: false
        };
        break;
      
      case 'set_brightness':
        if (parameters.brightness < 0 || parameters.brightness > 100) {
          success = false;
          result = { error: 'Brightness must be between 0 and 100' };
        } else {
          result = {
            brightness: parameters.brightness,
            power: parameters.brightness > 0
          };
        }
        break;
      
      case 'set_color':
        result = {
          color: parameters.color || '#ffffff'
        };
        break;
      
      default:
        result = {
          message: `Command ${command} executed with parameters`,
          parameters
        };
    }

    const responseTime = Date.now() - startTime;

    if (success) {
      res.status(200).json({
        success: true,
        result,
        meta: {
          deviceId,
          command,
          executedAt: new Date().toISOString(),
          responseTime
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'COMMAND_ERROR',
          message: result.error || 'Command execution failed'
        }
      });
    }

  } catch (error) {
    console.error('Device command error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEVICE_ERROR',
        message: 'Failed to execute device command'
      }
    });
  }
};

// Get device capabilities
const getCapabilities = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const mockCapabilities = {
      deviceId,
      capabilities: [
        {
          name: 'turn_on',
          description: 'Turn device on',
          parameters: [
            { name: 'brightness', type: 'integer', min: 1, max: 100, optional: true },
            { name: 'color', type: 'string', format: 'hex', optional: true }
          ]
        },
        {
          name: 'turn_off',
          description: 'Turn device off',
          parameters: []
        },
        {
          name: 'set_brightness',
          description: 'Set brightness level',
          parameters: [
            { name: 'brightness', type: 'integer', min: 0, max: 100, required: true }
          ]
        }
      ],
      supportedFormats: ['json'],
      version: '1.0.0'
    };

    res.status(200).json({
      success: true,
      data: mockCapabilities
    });

  } catch (error) {
    console.error('Device capabilities error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEVICE_ERROR',
        message: 'Failed to get device capabilities'
      }
    });
  }
};

module.exports = {
  // Legacy endpoints
  discoverDevices,
  getDeviceStatus,
  sendCommand,
  
  // v1 endpoints
  listDevices,
  executeCommand,
  getCapabilities
};
