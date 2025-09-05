const logger = require('../../utils/logger');

/**
 * アラーム・睡眠管理コントローラー
 * 目覚まし設定、睡眠追跡、寝坊対応機能
 */
class SleepController {
  
  /**
   * アラーム設定
   */
  async setAlarm(req, res) {
    try {
      const userId = req.user.userId;
      const { time, label, recurring, sounds, snoozeMinutes = 5 } = req.body;
      
      const User = require('../models/User');
      const alarmId = `alarm_${Date.now()}`;
      
      const alarmData = {
        id: alarmId,
        time,
        label: label || '目覚まし',
        recurring: recurring || { enabled: false },
        sounds: sounds || ['default_alarm'],
        snoozeMinutes,
        enabled: true,
        createdAt: new Date().toISOString()
      };
      
      await User.updateOne(
        { userId },
        {
          $push: {
            'preferences.alarms': alarmData
          }
        },
        { upsert: true }
      );
      
      // WebSocket経由でクライアントにアラーム設定を通知
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('alarm_set', {
          alarm: alarmData,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        alarm: alarmData,
        message: `アラームを ${time} に設定しました`
      });
    } catch (error) {
      logger.error('Failed to set alarm:', error);
      res.status(500).json({
        success: false,
        error: 'AlarmSetError',
        message: 'Failed to set alarm'
      });
    }
  }
  
  /**
   * アラーム一覧取得
   */
  async getAlarms(req, res) {
    try {
      const userId = req.user.userId;
      const User = require('../models/User');
      const user = await User.findOne({ userId });
      
      const alarms = user?.preferences?.alarms || [];
      
      res.json({
        success: true,
        alarms: alarms.map(alarm => ({
          id: alarm.id,
          time: alarm.time,
          label: alarm.label,
          recurring: alarm.recurring,
          enabled: alarm.enabled,
          sounds: alarm.sounds,
          snoozeMinutes: alarm.snoozeMinutes,
          createdAt: alarm.createdAt
        })),
        count: alarms.length
      });
    } catch (error) {
      logger.error('Failed to get alarms:', error);
      res.status(500).json({
        success: false,
        error: 'AlarmGetError',
        message: 'Failed to retrieve alarms'
      });
    }
  }
  
  /**
   * アラーム削除
   */
  async deleteAlarm(req, res) {
    try {
      const userId = req.user.userId;
      const { alarmId } = req.params;
      
      const User = require('../models/User');
      await User.updateOne(
        { userId },
        {
          $pull: {
            'preferences.alarms': { id: alarmId }
          }
        }
      );
      
      res.json({
        success: true,
        message: 'アラームを削除しました'
      });
    } catch (error) {
      logger.error('Failed to delete alarm:', error);
      res.status(500).json({
        success: false,
        error: 'AlarmDeleteError',
        message: 'Failed to delete alarm'
      });
    }
  }
  
  /**
   * 睡眠記録の保存
   */
  async recordSleep(req, res) {
    try {
      const userId = req.user.userId;
      const { bedtime, wakeTime, quality, notes } = req.body;
      
      const sleepRecord = {
        id: `sleep_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        bedtime,
        wakeTime,
        duration: this.calculateSleepDuration(bedtime, wakeTime),
        quality: quality || 5, // 1-10 scale
        notes: notes || '',
        recordedAt: new Date().toISOString()
      };
      
      const User = require('../models/User');
      await User.updateOne(
        { userId },
        {
          $push: {
            'preferences.sleepRecords': sleepRecord
          }
        },
        { upsert: true }
      );
      
      res.json({
        success: true,
        sleepRecord,
        message: '睡眠記録を保存しました'
      });
    } catch (error) {
      logger.error('Failed to record sleep:', error);
      res.status(500).json({
        success: false,
        error: 'SleepRecordError',
        message: 'Failed to record sleep'
      });
    }
  }
  
  /**
   * 睡眠データ取得
   */
  async getSleepData(req, res) {
    try {
      const userId = req.user.userId;
      const { period = 'week' } = req.query;
      
      const User = require('../models/User');
      const user = await User.findOne({ userId });
      
      const sleepRecords = user?.preferences?.sleepRecords || [];
      
      // 期間でフィルタ
      const now = new Date();
      let filterDate = new Date();
      if (period === 'week') {
        filterDate.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        filterDate.setMonth(now.getMonth() - 1);
      }
      
      const filteredRecords = sleepRecords.filter(record => 
        new Date(record.recordedAt) >= filterDate
      );
      
      // 統計計算
      const stats = this.calculateSleepStats(filteredRecords);
      
      res.json({
        success: true,
        sleepData: {
          records: filteredRecords,
          stats,
          period
        }
      });
    } catch (error) {
      logger.error('Failed to get sleep data:', error);
      res.status(500).json({
        success: false,
        error: 'SleepDataError',
        message: 'Failed to retrieve sleep data'
      });
    }
  }
  
  /**
   * 寝坊対応（鬼電＋ツッコミ）
   */
  async handleOversleep(req, res) {
    try {
      const userId = req.user.userId;
      const { alarmId, snoozeCount } = req.body;
      
      const User = require('../models/User');
      const user = await User.findOne({ userId });
      const alarm = user?.preferences?.alarms?.find(a => a.id === alarmId);
      
      if (!alarm) {
        return res.status(404).json({
          success: false,
          error: 'AlarmNotFound',
          message: 'Alarm not found'
        });
      }
      
      // 寝坊レベルに応じた対応
      let responseLevel = 'gentle';
      let message = '起きる時間ですよ〜';
      
      if (snoozeCount >= 3) {
        responseLevel = 'serious';
        message = 'もう起きてください！遅刻しますよ！';
      } else if (snoozeCount >= 5) {
        responseLevel = 'aggressive';
        message = 'いい加減に起きなさい！今すぐ起きないと大変なことになりますよ！';
      }
      
      // WebSocket経由で緊急アラーム送信
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('oversleep_alert', {
          alarmId,
          snoozeCount,
          responseLevel,
          message,
          actions: this.getOversleepActions(responseLevel),
          timestamp: new Date().toISOString()
        });
      }
      
      // 寝坊記録
      await User.updateOne(
        { userId },
        {
          $push: {
            'preferences.oversleepRecords': {
              alarmId,
              date: new Date().toISOString(),
              snoozeCount,
              responseLevel
            }
          }
        }
      );
      
      res.json({
        success: true,
        responseLevel,
        message,
        snoozeCount,
        actions: this.getOversleepActions(responseLevel)
      });
    } catch (error) {
      logger.error('Failed to handle oversleep:', error);
      res.status(500).json({
        success: false,
        error: 'OversleepError',
        message: 'Failed to handle oversleep'
      });
    }
  }
  
  /**
   * 睡眠時間の計算
   */
  calculateSleepDuration(bedtime, wakeTime) {
    const bed = new Date(`1970-01-01T${bedtime}:00`);
    const wake = new Date(`1970-01-01T${wakeTime}:00`);
    
    // 日をまたぐ場合の処理
    if (wake < bed) {
      wake.setDate(wake.getDate() + 1);
    }
    
    const duration = (wake - bed) / (1000 * 60 * 60); // hours
    return Math.round(duration * 100) / 100;
  }
  
  /**
   * 睡眠統計の計算
   */
  calculateSleepStats(records) {
    if (records.length === 0) {
      return {
        averageDuration: 0,
        averageQuality: 0,
        totalRecords: 0
      };
    }
    
    const totalDuration = records.reduce((sum, record) => sum + record.duration, 0);
    const totalQuality = records.reduce((sum, record) => sum + record.quality, 0);
    
    return {
      averageDuration: Math.round((totalDuration / records.length) * 100) / 100,
      averageQuality: Math.round((totalQuality / records.length) * 100) / 100,
      totalRecords: records.length,
      bestSleep: Math.max(...records.map(r => r.quality)),
      worstSleep: Math.min(...records.map(r => r.quality))
    };
  }
  
  /**
   * 寝坊レベルに応じたアクション
   */
  getOversleepActions(level) {
    const actions = {
      gentle: [
        { type: 'sound', action: 'play_gentle_alarm' },
        { type: 'vibration', action: 'gentle_vibrate' }
      ],
      serious: [
        { type: 'sound', action: 'play_loud_alarm' },
        { type: 'vibration', action: 'strong_vibrate' },
        { type: 'light', action: 'flash_screen' }
      ],
      aggressive: [
        { type: 'sound', action: 'play_emergency_alarm' },
        { type: 'vibration', action: 'max_vibrate' },
        { type: 'light', action: 'strobe_light' },
        { type: 'call', action: 'emergency_call' },
        { type: 'message', action: 'send_wake_up_messages' }
      ]
    };
    
    return actions[level] || actions.gentle;
  }
}

module.exports = new SleepController();
