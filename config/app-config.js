module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  },

  // Database Configuration
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/lumimei_os',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    }
  },

  // AI Configuration
  ai: {
    models: {
      nlp: {
        provider: process.env.NLP_PROVIDER || 'local',
        modelPath: process.env.LOCAL_NLP_MODEL || './ai-core/models/nlp-model',
        maxTokens: parseInt(process.env.MAX_TOKENS) || 2048,
        temperature: parseFloat(process.env.TEMPERATURE) || 0.7
      },
      tts: {
        provider: process.env.TTS_PROVIDER || 'local',
        voice: process.env.DEFAULT_VOICE || 'female-japanese',
        speed: parseFloat(process.env.TTS_SPEED) || 1.0
      },
      stt: {
        provider: process.env.STT_PROVIDER || 'local',
        language: process.env.STT_LANGUAGE || 'ja-JP',
        continuous: process.env.STT_CONTINUOUS === 'true'
      },
      vision: {
        provider: process.env.VISION_PROVIDER || 'local',
        modelPath: process.env.LOCAL_VISION_MODEL || './ai-core/models/vision-model'
      }
    }
  },

  // Security Configuration
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    bcrypt: {
      rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },

  // Device Integration
  devices: {
    discovery: {
      enabled: process.env.DEVICE_DISCOVERY === 'true',
      timeout: parseInt(process.env.DEVICE_DISCOVERY_TIMEOUT) || 30000,
      protocols: ['upnp', 'mdns', 'bluetooth']
    },
    control: {
      enabled: process.env.DEVICE_CONTROL === 'true',
      maxConcurrentCommands: parseInt(process.env.MAX_CONCURRENT_COMMANDS) || 10
    }
  },

  // Privacy & Data
  privacy: {
    dataRetention: {
      chatHistory: parseInt(process.env.CHAT_RETENTION_DAYS) || 365,
      userActivity: parseInt(process.env.ACTIVITY_RETENTION_DAYS) || 90,
      deviceLogs: parseInt(process.env.DEVICE_LOG_RETENTION_DAYS) || 30
    },
    encryption: {
      enabled: process.env.ENCRYPTION_ENABLED === 'true',
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm'
    },
    telemetry: {
      enabled: process.env.TELEMETRY_ENABLED === 'false',
      anonymize: process.env.ANONYMIZE_TELEMETRY === 'true'
    }
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/lumimei.log',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    maxSize: process.env.LOG_MAX_SIZE || '10m'
  },

  // Features
  features: {
    voiceMode: process.env.VOICE_MODE === 'true',
    visionMode: process.env.VISION_MODE === 'true',
    deviceControl: process.env.DEVICE_CONTROL === 'true',
    cloudSync: process.env.CLOUD_SYNC === 'false',
    friendSharing: process.env.FRIEND_SHARING === 'true'
  }
};
