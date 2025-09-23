const Joi = require('joi');

// Validation schemas
const schemas = {
  messageSchema: Joi.object({
    userId: Joi.string().required(),
    message: Joi.string().required(),
  // Allow flexible messageType values (legacy clients may send 'voice_question' etc.)
  messageType: Joi.string().default('text'),
    context: Joi.object().default({}),
    options: Joi.object({
      sessionId: Joi.string(),
      responseFormat: Joi.string().valid('text', 'audio', 'both').default('text'),
      includeActions: Joi.boolean().default(true),
      includeDeviceStatus: Joi.boolean().default(false),
      personalityMode: Joi.string().default('default'),
      verbosity: Joi.string().valid('minimal', 'normal', 'detailed').default('normal'),
      executeActions: Joi.boolean().default(false),
      broadcastToDevices: Joi.boolean().default(false)
    }).default({})
  }),

  voiceInputSchema: Joi.object({
    userId: Joi.string().required(),
    audioData: Joi.string().required(),
    format: Joi.string().valid('wav', 'mp3', 'ogg').default('wav'),
    options: Joi.object({
      language: Joi.string().default('ja-JP'),
      keepAudio: Joi.boolean().default(false),
      context: Joi.object().default({}),
      processAsMessage: Joi.boolean().default(true)
    }).default({})
  }),

  imageAnalysisSchema: Joi.object({
    userId: Joi.string().required(),
    imageData: Joi.string().required(),
    prompt: Joi.string(),
    options: Joi.object({
      detailLevel: Joi.string().valid('low', 'medium', 'high').default('medium'),
      includeObjects: Joi.boolean().default(true),
      includeText: Joi.boolean().default(true),
      includeFaces: Joi.boolean().default(false),
      processAsMessage: Joi.boolean().default(true)
    }).default({})
  }),

  deviceCommandSchema: Joi.object({
    userId: Joi.string().required(),
    deviceId: Joi.string().required(),
    command: Joi.string().required(),
    parameters: Joi.object().default({}),
    options: Joi.object({
      timeout: Joi.number().min(1000).max(60000).default(30000),
      retry: Joi.boolean().default(true),
      async: Joi.boolean().default(false)
    }).default({})
  }),

  // Authentication schemas
  registerSchema: Joi.object({
    userId: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    displayName: Joi.string().max(100).required(),
    deviceInfo: Joi.object({
      deviceId: Joi.string().required(),
      deviceName: Joi.string().required(),
      deviceType: Joi.string().valid('android', 'ios', 'windows', 'web', 'linux').required(),
      pushToken: Joi.string()
    })
  }),

  loginSchema: Joi.object({
    identifier: Joi.string().required(), // userId or email
    password: Joi.string().required(),
    deviceInfo: Joi.object({
      deviceId: Joi.string().required(),
      deviceName: Joi.string().required(),
      deviceType: Joi.string().valid('android', 'ios', 'windows', 'web', 'linux').required(),
      pushToken: Joi.string()
    })
  }),

  refreshTokenSchema: Joi.object({
    refreshToken: Joi.string().required()
  }),

  updateProfileSchema: Joi.object({
    displayName: Joi.string().max(100),
    personality: Joi.object({
      name: Joi.string(),
      traits: Joi.array().items(Joi.string()),
      voiceStyle: Joi.string(),
      responseStyle: Joi.string(),
      customizations: Joi.object()
    }),
    preferences: Joi.object({
      language: Joi.string(),
      timezone: Joi.string(),
      voiceMode: Joi.boolean(),
      notifications: Joi.boolean(),
      theme: Joi.string().valid('light', 'dark', 'auto')
    }),
    privacy: Joi.object({
      dataRetention: Joi.number().min(1).max(3650),
      shareData: Joi.boolean(),
      cloudSync: Joi.boolean(),
      analytics: Joi.boolean(),
      allowFriendSharing: Joi.boolean()
    })
  }),

  changePasswordSchema: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
  }),

  registerDeviceSchema: Joi.object({
    deviceInfo: Joi.object({
      deviceId: Joi.string().required(),
      deviceName: Joi.string().required(),
      deviceType: Joi.string().valid('android', 'ios', 'windows', 'web', 'linux').required(),
      pushToken: Joi.string()
    }).required()
  }),

  updateDeviceSchema: Joi.object({
    deviceName: Joi.string(),
    pushToken: Joi.string()
  }),

  // Chat API schema (client.py style)
  chatSchema: Joi.object({
    text: Joi.string().required(),
    role_sheet: Joi.object({
      tone: Joi.string(),
      personality: Joi.string(),
      style: Joi.string()
    }),
    over_hallucination: Joi.boolean().default(false),
    history: Joi.array().items(Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().required()
    })),
    compressed_memory: Joi.string(),
    options: Joi.object({
      includeDebug: Joi.boolean().default(false),
      maxTokens: Joi.number().min(100).max(4000).default(2000),
      temperature: Joi.number().min(0).max(2).default(0.7)
    }).default({})
  })
};

const validateRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: 'Invalid validation schema'
      });
    }

    // If authentication middleware has populated req.user, inject userId into body for compatibility
    try {
      if (req.user && !req.body) req.body = {};
      if (req.user && req.user.userId && typeof req.body.userId === 'undefined') {
        req.body.userId = req.user.userId;
      }
    } catch (e) { /* ignore */ }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorDetails
      });
    }

    req.body = value;
    next();
  };
};

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Rate limit exceeded',
      message
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Authentication middleware
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

module.exports = {
  validateRequest,
  schemas,
  createRateLimit,
  authenticateUser
};
