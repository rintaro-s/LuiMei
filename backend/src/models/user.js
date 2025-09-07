const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Device subdocument schema
const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true
  },
  deviceName: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet', 'smart_speaker', 'smart_display', 'wearable', 'other'],
    default: 'other'
  },
  platform: {
    type: String,
    enum: ['android', 'ios', 'windows', 'macos', 'linux', 'web', 'other'],
    default: 'other'
  },
  capabilities: {
    hasCamera: { type: Boolean, default: false },
    hasMicrophone: { type: Boolean, default: false },
    hasSpeaker: { type: Boolean, default: false },
    hasDisplay: { type: Boolean, default: false },
    supportsNotifications: { type: Boolean, default: false },
    supportsTTS: { type: Boolean, default: false },
    supportsSTT: { type: Boolean, default: false }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  pushToken: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Main user schema
const userSchema = new mongoose.Schema({
  // Google OAuth fields
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  // Optional password for legacy accounts
  password: {
    type: String,
    minlength: 6
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  firstName: String,
  lastName: String,
  profilePicture: String,
  
  // OAuth tokens
  accessToken: String,
  refreshToken: String,
  provider: {
    type: String,
    enum: ['google', 'local', 'guest'],
    default: 'guest'
  },
  
  // Personality and preferences
  personality: {
    mode: {
      type: String,
      enum: ['friendly', 'professional', 'casual', 'energetic', 'calm', 'custom'],
      default: 'friendly'
    },
    voice: {
      gender: { type: String, enum: ['male', 'female', 'neutral'], default: 'neutral' },
      speed: { type: Number, min: 0.5, max: 2.0, default: 1.0 },
      pitch: { type: Number, min: 0.5, max: 2.0, default: 1.0 },
      language: { type: String, default: 'ja-JP' }
    },
    responseStyle: {
      length: { type: String, enum: ['brief', 'normal', 'detailed'], default: 'normal' },
      formality: { type: String, enum: ['casual', 'polite', 'formal'], default: 'polite' },
      emoji: { type: Boolean, default: true },
      humor: { type: Boolean, default: true }
    },
    interests: [String],
    customTraits: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },

  // User preferences
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    language: { type: String, default: 'ja' },
    timezone: { type: String, default: 'Asia/Tokyo' },
    notifications: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      vibration: { type: Boolean, default: true }
    },
    privacy: {
      shareLocationData: { type: Boolean, default: false },
      shareUsageData: { type: Boolean, default: true },
      allowPersonalization: { type: Boolean, default: true },
      dataRetentionDays: { type: Number, default: 365 }
    },
    ai: {
      responseMode: { type: String, enum: ['instant', 'thoughtful', 'creative'], default: 'thoughtful' },
      learningEnabled: { type: Boolean, default: true },
      contextAwareness: { type: Boolean, default: true },
      proactiveMode: { type: Boolean, default: false }
    }
  },

  // Privacy settings
  privacy: {
    profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'private' },
    dataSharing: {
      analytics: { type: Boolean, default: true },
      improvements: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    dataRetention: {
      chatHistory: { type: Number, default: 365 }, // days
      voiceData: { type: Number, default: 30 },
      imageData: { type: Number, default: 90 }
    }
  },

  // Registered devices
  devices: [deviceSchema],

  // Subscription and usage
  subscription: {
    plan: { type: String, enum: ['free', 'premium', 'enterprise'], default: 'free' },
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true },
    features: [String]
  },

  usage: {
    totalMessages: { type: Number, default: 0 },
    totalVoiceMinutes: { type: Number, default: 0 },
    totalImageAnalyses: { type: Number, default: 0 },
    lastActivityDate: Date,
    monthlyUsage: {
      messages: { type: Number, default: 0 },
      voiceMinutes: { type: Number, default: 0 },
      imageAnalyses: { type: Number, default: 0 },
      month: { type: String } // YYYY-MM format
    }
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  },

  // Metadata
  metadata: {
    registrationSource: String, // 'web', 'mobile', 'api'
    referralCode: String,
    tags: [String],
    notes: String
  },

  // Life Assistant Data
  shoppingList: [{
    id: { type: String, default: () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` },
    name: { type: String, required: true },
    category: { type: String, default: '未分類' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: '個' },
    completed: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now },
    completedAt: Date
  }],

  cookingHistory: [{
    id: { type: String, default: () => `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` },
    recipeName: String,
    ingredients: [String],
    cookingTime: Number, // minutes
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    rating: { type: Number, min: 1, max: 5 },
    notes: String,
    cookedAt: { type: Date, default: Date.now }
  }],

  studySessions: [{
    sessionId: { type: String, default: () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` },
    subject: String,
    title: String,
    startTime: Date,
    endTime: Date,
    duration: Number, // minutes
    status: { type: String, enum: ['active', 'paused', 'completed', 'cancelled'], default: 'active' },
    goals: [String],
    achievements: [String],
    notes: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ userId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ lastLogin: 1 });

// Virtual for active devices
userSchema.virtual('activeDevices').get(function() {
  return this.devices.filter(device => device.isActive);
});

// Virtual for subscription status
userSchema.virtual('isSubscriptionActive').get(function() {
  if (!this.subscription.isActive) return false;
  if (this.subscription.plan === 'free') return true;
  if (!this.subscription.endDate) return false;
  return new Date() < this.subscription.endDate;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  try {
    // Generate userId if not exists
    if (!this.userId) {
      this.userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Hash password if modified and exists (for legacy accounts)
    if (this.password && this.isModified('password')) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }

    // Update monthly usage tracking
    const currentMonth = new Date().toISOString().substr(0, 7); // YYYY-MM
    if (this.usage.monthlyUsage.month !== currentMonth) {
      this.usage.monthlyUsage = {
        messages: 0,
        voiceMinutes: 0,
        imageAnalyses: 0,
        month: currentMonth
      };
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false; // OAuth users don't have passwords
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateAccessToken = function(accessToken, refreshToken = null) {
  this.accessToken = accessToken;
  if (refreshToken) this.refreshToken = refreshToken;
  this.lastLoginAt = new Date();
  return this.save();
};

userSchema.methods.hasPermission = function(permission) {
  return this.permissions.granted.includes(permission);
};

userSchema.methods.grantPermission = function(permission) {
  if (!this.permissions.granted.includes(permission)) {
    this.permissions.granted.push(permission);
    this.permissions.grantedAt[permission] = new Date();
  }
};

userSchema.methods.revokePermission = function(permission) {
  this.permissions.granted = this.permissions.granted.filter(p => p !== permission);
  delete this.permissions.grantedAt[permission];
};

userSchema.methods.addFriend = async function(friendUserId) {
  if (!this.friends.list.includes(friendUserId)) {
    this.friends.list.push(friendUserId);
    this.friends.addedAt[friendUserId] = new Date();
    this.markModified('friends');
    await this.save();
  }
};

userSchema.methods.removeFriend = async function(friendUserId) {
  this.friends.list = this.friends.list.filter(id => id !== friendUserId);
  delete this.friends.addedAt[friendUserId];
  this.markModified('friends');
  await this.save();
};

userSchema.methods.isGoogleUser = function() {
  return this.provider === 'google' && this.googleId;
};

userSchema.methods.getPublicProfile = function() {
  return {
    userId: this.userId,
    firstName: this.firstName,
    lastName: this.lastName,
    profilePicture: this.profilePicture,
    personality: this.personality,
    createdAt: this.createdAt,
    isOnline: this.status.isOnline,
    lastActiveAt: this.status.lastActiveAt
  };
};

userSchema.methods.incrementUsage = function(type, amount = 1) {
  const currentMonth = new Date().toISOString().substr(0, 7);
  
  // Update monthly usage if month changed
  if (this.usage.monthlyUsage.month !== currentMonth) {
    this.usage.monthlyUsage = {
      messages: 0,
      voiceMinutes: 0,
      imageAnalyses: 0,
      month: currentMonth
    };
  }

  // Increment counters
  switch (type) {
    case 'message':
      this.usage.totalMessages += amount;
      this.usage.monthlyUsage.messages += amount;
      break;
    case 'voice':
      this.usage.totalVoiceMinutes += amount;
      this.usage.monthlyUsage.voiceMinutes += amount;
      break;
    case 'image':
      this.usage.totalImageAnalyses += amount;
      this.usage.monthlyUsage.imageAnalyses += amount;
      break;
  }

  this.usage.lastActivityDate = new Date();
  return this.save();
};

userSchema.methods.addDevice = function(deviceInfo) {
  // Remove existing device with same deviceId
  this.devices = this.devices.filter(d => d.deviceId !== deviceInfo.deviceId);
  
  // Add new device
  this.devices.push({
    ...deviceInfo,
    lastSeen: new Date(),
    isActive: true
  });

  return this.save();
};

userSchema.methods.updateDevice = function(deviceId, updates) {
  const device = this.devices.find(d => d.deviceId === deviceId);
  if (device) {
    Object.assign(device, updates);
    device.lastSeen = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

userSchema.methods.removeDevice = function(deviceId) {
  this.devices = this.devices.filter(d => d.deviceId !== deviceId);
  return this.save();
};

userSchema.methods.getPublicProfile = function() {
  return {
    userId: this.userId,
    displayName: this.displayName,
    personality: this.personality,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    subscription: {
      plan: this.subscription.plan,
      isActive: this.isSubscriptionActive
    },
    joinDate: this.createdAt
  };
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

// Static methods
userSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId, isActive: true });
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

userSchema.statics.createUser = async function(userData) {
  const user = new this(userData);
  return user.save();
};

module.exports = mongoose.model('User', userSchema);
