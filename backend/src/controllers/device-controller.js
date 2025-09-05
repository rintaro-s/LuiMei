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

// Register device
const registerDevice = async (req, res) => {
  try {
    const { deviceId, name, type, capabilities } = req.body;

    const device = {
      deviceId: deviceId || `device_${Date.now()}`,
      name: name || 'Unknown Device',
      type: type || 'unknown',
      capabilities: capabilities || [],
      registeredAt: new Date().toISOString(),
      status: 'online'
    };

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      data: { device }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Device registration failed'
    });
  }
};

// Unregister device
const unregisterDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    res.status(200).json({
      success: true,
      message: `Device ${deviceId} unregistered successfully`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Device unregistration failed'
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

/**
 * スマホ設定の制御（DND、Wi-Fi等）
 */
const controlPhoneSettings = async (req, res) => {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { action, setting, value } = req.body;
    
    const supportedSettings = {
      'dnd': 'Do Not Disturb',
      'wifi': 'Wi-Fi',
      'bluetooth': 'Bluetooth',
      'brightness': 'Screen Brightness',
      'volume': 'Volume',
      'airplane': 'Airplane Mode'
    };
    
    if (!supportedSettings[setting]) {
      return res.status(400).json({
        success: false,
        error: 'UnsupportedSetting',
        message: `Setting ${setting} is not supported`,
        supportedSettings: Object.keys(supportedSettings)
      });
    }
    
    // WebSocket経由でクライアントに設定変更を指示
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('phone_setting_control', {
        action,
        setting,
        value,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Phone setting control: ${userId} - ${setting} ${action} ${value}`);
    
    res.json({
      success: true,
      message: `${supportedSettings[setting]} ${action} command sent`,
      setting,
      action,
      value
    });
  } catch (error) {
    console.error('Failed to control phone settings:', error);
    res.status(500).json({
      success: false,
      error: 'DeviceControlError',
      message: 'Failed to control phone settings'
    });
  }
};

/**
 * LINE メッセージ送信
 */
const sendLineMessage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { recipientId, message, replyToMessageId } = req.body;
    
    // WebSocket経由でクライアントにメッセージ送信を指示
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('line_message_send', {
        recipientId,
        message,
        replyToMessageId,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'LINE message sent',
      recipientId,
      messageText: message
    });
  } catch (error) {
    console.error('Failed to send LINE message:', error);
    res.status(500).json({
      success: false,
      error: 'LineMessageError',
      message: 'Failed to send LINE message'
    });
  }
};

/**
 * Discord メッセージ送信
 */
const sendDiscordMessage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { channelId, message, guildId } = req.body;
    
    // WebSocket経由でクライアントにメッセージ送信を指示
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('discord_message_send', {
        channelId,
        message,
        guildId,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Discord message sent',
      channelId,
      messageText: message
    });
  } catch (error) {
    console.error('Failed to send Discord message:', error);
    res.status(500).json({
      success: false,
      error: 'DiscordMessageError',
      message: 'Failed to send Discord message'
    });
  }
};

/**
 * 統合操作（複数デバイス/サービスの連携）
 */
const executeIntegratedAction = async (req, res) => {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { actionName, parameters } = req.body;
    
    // 定義済みの統合操作
    const integratedActions = {
      'goodnight': {
        description: '就寝モード: DND有効、照明オフ、音量下げる',
        steps: [
          { type: 'phone', action: 'enable', setting: 'dnd' },
          { type: 'smart_device', command: 'lights_off', deviceId: 'bedroom_lights' },
          { type: 'phone', action: 'set', setting: 'volume', value: 10 }
        ]
      },
      'morning': {
        description: '起床モード: DND解除、照明オン、天気情報取得',
        steps: [
          { type: 'phone', action: 'disable', setting: 'dnd' },
          { type: 'smart_device', command: 'lights_on', deviceId: 'bedroom_lights' },
          { type: 'calendar', action: 'get_today_events' }
        ]
      },
      'work_mode': {
        description: '作業モード: DND有効、集中用音楽再生',
        steps: [
          { type: 'phone', action: 'enable', setting: 'dnd' },
          { type: 'smart_device', command: 'play_music', parameters: { playlist: 'focus' } }
        ]
      }
    };
    
    if (!integratedActions[actionName]) {
      return res.status(400).json({
        success: false,
        error: 'UnknownAction',
        message: `Action ${actionName} is not defined`,
        availableActions: Object.keys(integratedActions)
      });
    }
    
    const action = integratedActions[actionName];
    const results = [];
    
    // WebSocket経由で統合操作を順次実行
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('integrated_action_start', {
        actionName,
        description: action.description,
        steps: action.steps,
        timestamp: new Date().toISOString()
      });
      
      // 各ステップを順次実行
      for (const step of action.steps) {
        io.to(`user_${userId}`).emit('integrated_action_step', {
          actionName,
          step,
          timestamp: new Date().toISOString()
        });
        results.push({ step, status: 'executed' });
      }
    }
    
    res.json({
      success: true,
      actionName,
      description: action.description,
      results,
      executedSteps: action.steps.length
    });
  } catch (error) {
    console.error('Failed to execute integrated action:', error);
    res.status(500).json({
      success: false,
      error: 'IntegratedActionError',
      message: 'Failed to execute integrated action'
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
  getCapabilities,
  
  // Device management
  registerDevice,
  unregisterDevice,
  
  // Extended functionality
  controlPhoneSettings,
  sendLineMessage,
  sendDiscordMessage,
  executeIntegratedAction
};
