const logger = require('../../utils/logger');

/**
 * 設定管理コントローラー
 * アプリ全体の設定と個人設定を統合管理
 */
class SettingsController {

  /**
   * すべての設定を取得
   */
  async getAllSettings(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      
      // 実際のユーザーデータを取得を試行、失敗時はデフォルト設定
      let userSettings = {};
      
      try {
        const User = require('../models/User');
        const user = await User.findOne({ userId });
        userSettings = user?.preferences || {};
      } catch (dbError) {
        console.log('Database not available, using default settings');
        userSettings = this.getDefaultSettings();
      }

      const allSettings = {
        // アプリ基本設定
        app: {
          theme: userSettings.theme || 'auto',
          language: userSettings.language || 'ja',
          fontSize: userSettings.fontSize || 'medium',
          animations: userSettings.animations !== false,
          hapticFeedback: userSettings.hapticFeedback !== false,
          autoLock: userSettings.autoLock || '5min',
          backupEnabled: userSettings.backupEnabled !== false
        },
        
        // 音声・音響設定
        voice: {
          wakeWord: userSettings.wakeWord || {
            enabled: true,
            sensitivity: 0.7,
            keyword: 'メイミ',
            timeout: 5000
          },
          tts: userSettings.tts || {
            voice: 'ja-JP-Wavenet-B',
            speed: 1.0,
            pitch: 0.0,
            volume: 0.8,
            enabled: true
          },
          stt: userSettings.stt || {
            language: 'ja-JP',
            continuousMode: false,
            noiseReduction: true,
            autoStop: true,
            timeout: 8000
          },
          microphone: userSettings.microphone || {
            sensitivity: 0.8,
            noiseGate: 0.1,
            autoGainControl: true
          }
        },
        
        // 通知設定
        notifications: {
          push: userSettings.notifications?.push !== false,
          sound: userSettings.notifications?.sound !== false,
          vibration: userSettings.notifications?.vibration !== false,
          led: userSettings.notifications?.led !== false,
          quietHours: userSettings.notifications?.quietHours || {
            enabled: false,
            start: '22:00',
            end: '07:00'
          },
          priority: userSettings.notifications?.priority || 'normal',
          categories: {
            chat: userSettings.notifications?.categories?.chat !== false,
            reminders: userSettings.notifications?.categories?.reminders !== false,
            alarms: userSettings.notifications?.categories?.alarms !== false,
            study: userSettings.notifications?.categories?.study !== false,
            health: userSettings.notifications?.categories?.health !== false
          }
        },
        
        // プライバシー設定
        privacy: {
          dataCollection: userSettings.privacy?.dataCollection !== false,
          analytics: userSettings.privacy?.analytics !== false,
          locationSharing: userSettings.privacy?.locationSharing || false,
          voiceRecording: userSettings.privacy?.voiceRecording !== false,
          personalizedAds: userSettings.privacy?.personalizedAds || false,
          thirdPartySharing: userSettings.privacy?.thirdPartySharing || false,
          dataRetention: userSettings.privacy?.dataRetention || '1year',
          exportData: userSettings.privacy?.exportData || false
        },
        
        // AI・機械学習設定
        ai: {
          personalityLearning: userSettings.ai?.personalityLearning !== false,
          contextAwareness: userSettings.ai?.contextAwareness !== false,
          proactiveMode: userSettings.ai?.proactiveMode || false,
          responseStyle: userSettings.ai?.responseStyle || 'friendly',
          creativityLevel: userSettings.ai?.creativityLevel || 0.7,
          memoryRetention: userSettings.ai?.memoryRetention !== false,
          offlineMode: userSettings.ai?.offlineMode || false
        },
        
        // セキュリティ設定
        security: {
          biometric: userSettings.security?.biometric || false,
          pinCode: userSettings.security?.pinCode || false,
          autoLock: userSettings.security?.autoLock !== false,
          encryptData: userSettings.security?.encryptData !== false,
          sessionTimeout: userSettings.security?.sessionTimeout || '30min',
          deviceTrust: userSettings.security?.deviceTrust || 'auto'
        },
        
        // 接続設定
        connectivity: {
          wifiOnly: userSettings.connectivity?.wifiOnly || false,
          backgroundSync: userSettings.connectivity?.backgroundSync !== false,
          cloudBackup: userSettings.connectivity?.cloudBackup !== false,
          networkOptimization: userSettings.connectivity?.networkOptimization !== false,
          offlineCache: userSettings.connectivity?.offlineCache !== false
        },
        
        // アクセシビリティ設定
        accessibility: {
          highContrast: userSettings.accessibility?.highContrast || false,
          largeText: userSettings.accessibility?.largeText || false,
          screenReader: userSettings.accessibility?.screenReader || false,
          voiceNavigation: userSettings.accessibility?.voiceNavigation || false,
          gestureNavigation: userSettings.accessibility?.gestureNavigation !== false,
          colorBlindSupport: userSettings.accessibility?.colorBlindSupport || false
        },
        
        // デバイス統合設定
        deviceIntegration: {
          phoneControl: userSettings.deviceIntegration?.phoneControl || false,
          smartHome: userSettings.deviceIntegration?.smartHome || false,
          wearableSync: userSettings.deviceIntegration?.wearableSync || false,
          calendarSync: userSettings.deviceIntegration?.calendarSync !== false,
          contactsSync: userSettings.deviceIntegration?.contactsSync || false
        }
      };

      res.json({
        success: true,
        settings: allSettings,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get all settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve settings'
      });
    }
  }

  /**
   * 設定を更新
   */
  async updateSettings(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { category, settings } = req.body;

      if (!category || !settings) {
        return res.status(400).json({
          success: false,
          error: 'Category and settings are required'
        });
      }

      // 有効なカテゴリーを検証
      const validCategories = [
        'app', 'voice', 'notifications', 'privacy', 'ai', 
        'security', 'connectivity', 'accessibility', 'deviceIntegration'
      ];

      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid settings category',
          validCategories
        });
      }

      // 設定を検証・サニタイズ
      const sanitizedSettings = this.sanitizeSettings(category, settings);

      try {
        const User = require('../models/User');
        
        // 設定を更新
        const updatePath = `preferences.${category}`;
        await User.updateOne(
          { userId },
          {
            $set: {
              [updatePath]: sanitizedSettings,
              'preferences.lastUpdated': new Date().toISOString()
            }
          },
          { upsert: true }
        );

        // 特定の設定変更に対する追加処理
        await this.handleSettingsChange(userId, category, sanitizedSettings);

        res.json({
          success: true,
          message: `${category} settings updated successfully`,
          updatedSettings: sanitizedSettings
        });
      } catch (dbError) {
        console.log('Database not available, settings not persisted');
        res.json({
          success: true,
          message: `${category} settings updated (session only)`,
          updatedSettings: sanitizedSettings,
          warning: 'Settings will be lost when session ends'
        });
      }
    } catch (error) {
      logger.error('Failed to update settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update settings'
      });
    }
  }

  /**
   * 設定をリセット
   */
  async resetSettings(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { category } = req.body;

      const defaultSettings = this.getDefaultSettings();

      if (category && category !== 'all') {
        // 特定カテゴリーのみリセット
        const categoryDefaults = defaultSettings[category];
        if (!categoryDefaults) {
          return res.status(400).json({
            success: false,
            error: 'Invalid category for reset'
          });
        }

        try {
          const User = require('../models/User');
          const updatePath = `preferences.${category}`;
          await User.updateOne(
            { userId },
            {
              $set: {
                [updatePath]: categoryDefaults,
                'preferences.lastUpdated': new Date().toISOString()
              }
            },
            { upsert: true }
          );
        } catch (dbError) {
          console.log('Database not available for reset');
        }

        res.json({
          success: true,
          message: `${category} settings reset to defaults`,
          resetSettings: categoryDefaults
        });
      } else {
        // 全設定をリセット
        try {
          const User = require('../models/User');
          await User.updateOne(
            { userId },
            {
              $set: {
                preferences: defaultSettings,
                'preferences.lastUpdated': new Date().toISOString()
              }
            },
            { upsert: true }
          );
        } catch (dbError) {
          console.log('Database not available for full reset');
        }

        res.json({
          success: true,
          message: 'All settings reset to defaults',
          resetSettings: defaultSettings
        });
      }
    } catch (error) {
      logger.error('Failed to reset settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset settings'
      });
    }
  }

  /**
   * 設定をエクスポート
   */
  async exportSettings(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      
      try {
        const User = require('../models/User');
        const user = await User.findOne({ userId });
        const userSettings = user?.preferences || this.getDefaultSettings();

        const exportData = {
          version: '1.0',
          userId: userId,
          exportedAt: new Date().toISOString(),
          settings: userSettings
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="meimi-settings-${userId}-${Date.now()}.json"`);
        res.json(exportData);
      } catch (dbError) {
        console.log('Database not available for export');
        res.status(500).json({
          success: false,
          error: 'Settings export unavailable'
        });
      }
    } catch (error) {
      logger.error('Failed to export settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export settings'
      });
    }
  }

  /**
   * 設定をインポート
   */
  async importSettings(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { settingsData } = req.body;

      if (!settingsData || !settingsData.settings) {
        return res.status(400).json({
          success: false,
          error: 'Invalid settings data format'
        });
      }

      // インポート設定を検証
      const validatedSettings = this.validateImportedSettings(settingsData.settings);

      try {
        const User = require('../models/User');
        await User.updateOne(
          { userId },
          {
            $set: {
              preferences: validatedSettings,
              'preferences.lastUpdated': new Date().toISOString(),
              'preferences.importedAt': new Date().toISOString()
            }
          },
          { upsert: true }
        );

        res.json({
          success: true,
          message: 'Settings imported successfully',
          importedAt: new Date().toISOString()
        });
      } catch (dbError) {
        console.log('Database not available for import');
        res.status(500).json({
          success: false,
          error: 'Settings import unavailable'
        });
      }
    } catch (error) {
      logger.error('Failed to import settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import settings'
      });
    }
  }

  /**
   * デフォルト設定を取得
   */
  getDefaultSettings() {
    return {
      theme: 'auto',
      language: 'ja',
      fontSize: 'medium',
      animations: true,
      hapticFeedback: true,
      wakeWord: {
        enabled: true,
        sensitivity: 0.7,
        keyword: 'メイミ',
        timeout: 5000
      },
      tts: {
        voice: 'ja-JP-Wavenet-B',
        speed: 1.0,
        pitch: 0.0,
        volume: 0.8,
        enabled: true
      },
      notifications: {
        push: true,
        sound: true,
        vibration: true,
        categories: {
          chat: true,
          reminders: true,
          alarms: true,
          study: true,
          health: true
        }
      },
      privacy: {
        dataCollection: true,
        analytics: true,
        locationSharing: false,
        voiceRecording: true
      },
      ai: {
        personalityLearning: true,
        contextAwareness: true,
        responseStyle: 'friendly'
      }
    };
  }

  /**
   * 設定をサニタイズ
   */
  sanitizeSettings(category, settings) {
    // 型チェックと範囲制限
    const sanitized = { ...settings };

    if (category === 'voice') {
      if (sanitized.tts) {
        sanitized.tts.speed = Math.max(0.5, Math.min(2.0, sanitized.tts.speed || 1.0));
        sanitized.tts.pitch = Math.max(-1.0, Math.min(1.0, sanitized.tts.pitch || 0.0));
        sanitized.tts.volume = Math.max(0.0, Math.min(1.0, sanitized.tts.volume || 0.8));
      }
      if (sanitized.wakeWord) {
        sanitized.wakeWord.sensitivity = Math.max(0.1, Math.min(1.0, sanitized.wakeWord.sensitivity || 0.7));
        sanitized.wakeWord.timeout = Math.max(1000, Math.min(30000, sanitized.wakeWord.timeout || 5000));
      }
    }

    if (category === 'ai') {
      if (sanitized.creativityLevel !== undefined) {
        sanitized.creativityLevel = Math.max(0.0, Math.min(1.0, sanitized.creativityLevel));
      }
    }

    return sanitized;
  }

  /**
   * 設定変更時の追加処理
   */
  async handleSettingsChange(userId, category, settings) {
    try {
      // ウェイクワード設定が変更された場合
      if (category === 'voice' && settings.wakeWord) {
        // ウェイクワード認識エンジンを再初期化
        const io = require('../app').get('io');
        if (io) {
          io.to(`user_${userId}`).emit('wake_word_config_updated', {
            config: settings.wakeWord,
            timestamp: new Date().toISOString()
          });
        }
      }

      // テーマ変更時
      if (category === 'app' && settings.theme) {
        logger.info(`User ${userId} changed theme to ${settings.theme}`);
      }

      // プライバシー設定変更時
      if (category === 'privacy') {
        logger.info(`User ${userId} updated privacy settings`);
      }
    } catch (error) {
      logger.error('Error handling settings change:', error);
    }
  }

  /**
   * インポート設定を検証
   */
  validateImportedSettings(settings) {
    const defaults = this.getDefaultSettings();
    const validated = { ...defaults };

    // 基本的な型チェックとデフォルト値での補完
    Object.keys(defaults).forEach(key => {
      if (settings.hasOwnProperty(key)) {
        if (typeof settings[key] === typeof defaults[key]) {
          validated[key] = settings[key];
        }
      }
    });

    return validated;
  }
}

module.exports = new SettingsController();
