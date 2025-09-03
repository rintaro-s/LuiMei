const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

// JWT utility functions
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Register new user
const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      email,
      password,
      displayName,
      personality = {},
      preferences = {},
      privacy = {},
      deviceInfo = {}
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase() 
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'A user with this email address already exists'
      });
    }

    // Create new user
    const userData = {
      email: email.toLowerCase(),
      password,
      displayName,
      personality: {
        mode: personality.mode || 'friendly',
        voice: {
          gender: personality.voice?.gender || 'neutral',
          speed: personality.voice?.speed || 1.0,
          pitch: personality.voice?.pitch || 1.0,
          language: personality.voice?.language || 'ja-JP'
        },
        responseStyle: {
          length: personality.responseStyle?.length || 'normal',
          formality: personality.responseStyle?.formality || 'polite',
          emoji: personality.responseStyle?.emoji !== false,
          humor: personality.responseStyle?.humor !== false
        },
        interests: personality.interests || [],
        customTraits: personality.customTraits || new Map()
      },
      preferences: {
        theme: preferences.theme || 'auto',
        language: preferences.language || 'ja',
        timezone: preferences.timezone || 'Asia/Tokyo',
        notifications: {
          push: preferences.notifications?.push !== false,
          email: preferences.notifications?.email !== false,
          sound: preferences.notifications?.sound !== false,
          vibration: preferences.notifications?.vibration !== false
        },
        privacy: {
          shareLocationData: preferences.privacy?.shareLocationData || false,
          shareUsageData: preferences.privacy?.shareUsageData !== false,
          allowPersonalization: preferences.privacy?.allowPersonalization !== false,
          dataRetentionDays: preferences.privacy?.dataRetentionDays || 365
        },
        ai: {
          responseMode: preferences.ai?.responseMode || 'thoughtful',
          learningEnabled: preferences.ai?.learningEnabled !== false,
          contextAwareness: preferences.ai?.contextAwareness !== false,
          proactiveMode: preferences.ai?.proactiveMode || false
        }
      },
      privacy: {
        profileVisibility: privacy.profileVisibility || 'private',
        dataSharing: {
          analytics: privacy.dataSharing?.analytics !== false,
          improvements: privacy.dataSharing?.improvements !== false,
          marketing: privacy.dataSharing?.marketing || false
        },
        dataRetention: {
          chatHistory: privacy.dataRetention?.chatHistory || 365,
          voiceData: privacy.dataRetention?.voiceData || 30,
          imageData: privacy.dataRetention?.imageData || 90
        }
      },
      metadata: {
        registrationSource: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
        referralCode: req.body.referralCode
      }
    };

    const user = await User.createUser(userData);

    // Add device info if provided
    if (deviceInfo.deviceId) {
      await user.addDevice({
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName || 'Unknown Device',
        deviceType: deviceInfo.deviceType || 'other',
        platform: deviceInfo.platform || 'other',
        capabilities: deviceInfo.capabilities || {},
        pushToken: deviceInfo.pushToken
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.userId);

    // Update login info
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getPublicProfile(),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, deviceInfo = {} } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Add or update device info
    if (deviceInfo.deviceId) {
      await user.addDevice({
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName || 'Unknown Device',
        deviceType: deviceInfo.deviceType || 'other',
        platform: deviceInfo.platform || 'other',
        capabilities: deviceInfo.capabilities || {},
        pushToken: deviceInfo.pushToken
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.userId);

    // Update login info
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token provided'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret'
    );

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    // Find user
    const user = await User.findByUserId(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.userId);

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findByUserId(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = await User.findByUserId(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updates = req.body;
    
    // Update allowed fields
    if (updates.displayName) user.displayName = updates.displayName;
    if (updates.personality) Object.assign(user.personality, updates.personality);
    if (updates.preferences) Object.assign(user.preferences, updates.preferences);
    if (updates.privacy) Object.assign(user.privacy, updates.privacy);

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findByUserId(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};

// Logout (optional - mainly for cleanup)
const logout = async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (deviceId) {
      const user = await User.findByUserId(req.userId);
      if (user) {
        await user.updateDevice(deviceId, { isActive: false });
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
};

// Delete account
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findByUserId(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify password for account deletion
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Soft delete - mark as inactive
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
};

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    );

    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    req.userId = decoded.userId;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Device management
const registerDevice = async (req, res) => {
  try {
    const user = await User.findByUserId(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.addDevice(req.body);

    res.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        devices: user.activeDevices
      }
    });

  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register device'
    });
  }
};

const getDevices = async (req, res) => {
  try {
    const user = await User.findByUserId(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        devices: user.activeDevices
      }
    });

  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get devices'
    });
  }
};

const removeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const user = await User.findByUserId(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.removeDevice(deviceId);

    res.json({
      success: true,
      message: 'Device removed successfully',
      data: {
        devices: user.activeDevices
      }
    });

  } catch (error) {
    console.error('Remove device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove device'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  deleteAccount,
  requireAuth,
  registerDevice,
  getDevices,
  removeDevice,
  generateTokens
};
