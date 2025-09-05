const logger = require('../../utils/logger');

/**
 * ウェイクワード検出とアシスタント起動コントローラー
 * 「Hey 〇〇」などの音声でアシスタントをアクティベート
 */
class WakeWordController {
  
  /**
   * ウェイクワード設定の取得
   */
  async getWakeWordSettings(req, res) {
    try {
      const userId = req.user.userId;
      const User = require('../models/User');
      const user = await User.findOne({ userId });
      
      const settings = user?.preferences?.wakeWord || {
        enabled: true,
        customName: "ルミメイ",
        sensitivity: 0.7,
        responseDelay: 500,
        popupDuration: 10000
      };
      
      res.json({
        success: true,
        settings
      });
    } catch (error) {
      logger.error('Failed to get wake word settings:', error);
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to retrieve wake word settings'
      });
    }
  }
  
  /**
   * ウェイクワード設定の更新
   */
  async updateWakeWordSettings(req, res) {
    try {
      const userId = req.user.userId;
      const { customName, sensitivity, responseDelay, popupDuration, enabled } = req.body;
      
      const User = require('../models/User');
      await User.updateOne(
        { userId },
        {
          $set: {
            'preferences.wakeWord': {
              enabled: enabled !== undefined ? enabled : true,
              customName: customName || "ルミメイ",
              sensitivity: sensitivity || 0.7,
              responseDelay: responseDelay || 500,
              popupDuration: popupDuration || 10000
            }
          }
        },
        { upsert: true }
      );
      
      res.json({
        success: true,
        message: 'Wake word settings updated'
      });
    } catch (error) {
      logger.error('Failed to update wake word settings:', error);
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to update wake word settings'
      });
    }
  }
  
  /**
   * ウェイクワード検出の処理
   * 音声ストリームから特定のフレーズを検出
   */
  async processWakeWordDetection(req, res) {
    try {
      const userId = req.user.userId;
      const { audioData, detectedPhrase, confidence } = req.body;
      
      logger.info(`Wake word detected for user ${userId}: ${detectedPhrase} (confidence: ${confidence})`);
      
      // セッション作成
      const sessionId = `wake_${userId}_${Date.now()}`;
      
      // WebSocket経由でクライアントにポップアップ表示を指示
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('wake_word_detected', {
          sessionId,
          detectedPhrase,
          confidence,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        sessionId,
        message: 'Wake word processed successfully'
      });
    } catch (error) {
      logger.error('Failed to process wake word detection:', error);
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to process wake word detection'
      });
    }
  }
}

module.exports = new WakeWordController();
