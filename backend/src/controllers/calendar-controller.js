const { google } = require('googleapis');
const logger = require('../../utils/logger');

/**
 * Google Calendar / Tasks 連携コントローラー
 * カレンダー情報の取得、予定作成、タスク管理
 */
class CalendarController {
  
  /**
   * Google Calendar認証クライアントの取得
   */
  async getCalendarClient(userId) {
    const User = require('../models/User');
    const user = await User.findOne({ userId });
    
    if (!user?.googleCredentials?.accessToken) {
      throw new Error('Google Calendar authentication required');
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_OAUTH2_CLIENT_ID,
      process.env.GCP_OAUTH2_CLIENT_SECRET,
      process.env.GCP_OAUTH2_REDIRECT_URI?.split(',')[0]
    );
    
    oauth2Client.setCredentials({
      access_token: user.googleCredentials.accessToken,
      refresh_token: user.googleCredentials.refreshToken,
    });
    
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }
  
  /**
   * 今日の予定を取得
   */
  async getTodayEvents(req, res) {
    try {
      const userId = req.user.userId;
      const calendar = await this.getCalendarClient(userId);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: today.toISOString(),
        timeMax: tomorrow.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      const events = response.data.items.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location,
        status: event.status
      }));
      
      res.json({
        success: true,
        events,
        count: events.length
      });
    } catch (error) {
      logger.error('Failed to get today events:', error);
      res.status(500).json({
        success: false,
        error: 'CalendarAccessError',
        message: 'Failed to retrieve calendar events'
      });
    }
  }
  
  /**
   * 週間予定を取得
   */
  async getWeeklyEvents(req, res) {
    try {
      const userId = req.user.userId;
      const calendar = await this.getCalendarClient(userId);
      
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfWeek.toISOString(),
        timeMax: endOfWeek.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      const events = response.data.items.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location,
        status: event.status
      }));
      
      res.json({
        success: true,
        events,
        count: events.length,
        period: {
          start: startOfWeek.toISOString(),
          end: endOfWeek.toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get weekly events:', error);
      res.status(500).json({
        success: false,
        error: 'CalendarAccessError',
        message: 'Failed to retrieve weekly calendar events'
      });
    }
  }
  
  /**
   * 予定作成
   */
  async createEvent(req, res) {
    try {
      const userId = req.user.userId;
      const { summary, description, startTime, endTime, location } = req.body;
      
      const calendar = await this.getCalendarClient(userId);
      
      const event = {
        summary,
        description,
        start: {
          dateTime: startTime,
          timeZone: 'Asia/Tokyo',
        },
        end: {
          dateTime: endTime,
          timeZone: 'Asia/Tokyo',
        },
        location,
      };
      
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      
      res.json({
        success: true,
        event: {
          id: response.data.id,
          summary: response.data.summary,
          start: response.data.start,
          end: response.data.end,
          htmlLink: response.data.htmlLink
        }
      });
    } catch (error) {
      logger.error('Failed to create calendar event:', error);
      res.status(500).json({
        success: false,
        error: 'CalendarCreateError',
        message: 'Failed to create calendar event'
      });
    }
  }
  
  /**
   * 進捗チェック - 特定のタスクや予定の完了状況を確認
   */
  async checkProgress(req, res) {
    try {
      const userId = req.user.userId;
      const { taskName, period = 'week' } = req.query;
      
      const calendar = await this.getCalendarClient(userId);
      
      // 期間設定
      const now = new Date();
      let startDate = new Date();
      if (period === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      }
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: now.toISOString(),
        q: taskName, // キーワード検索
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      const events = response.data.items;
      const completedEvents = events.filter(event => 
        event.status === 'confirmed' && 
        (event.summary?.includes('完了') || event.description?.includes('完了'))
      );
      
      const progressData = {
        taskName,
        period,
        totalFound: events.length,
        completed: completedEvents.length,
        completionRate: events.length > 0 ? (completedEvents.length / events.length * 100).toFixed(1) : 0,
        events: events.map(event => ({
          id: event.id,
          summary: event.summary,
          start: event.start.dateTime || event.start.date,
          status: event.status,
          isCompleted: event.status === 'confirmed' && 
            (event.summary?.includes('完了') || event.description?.includes('完了'))
        }))
      };
      
      res.json({
        success: true,
        progress: progressData
      });
    } catch (error) {
      logger.error('Failed to check progress:', error);
      res.status(500).json({
        success: false,
        error: 'ProgressCheckError',
        message: 'Failed to check task progress'
      });
    }
  }
}

module.exports = new CalendarController();
