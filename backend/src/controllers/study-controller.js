const logger = require('../../utils/logger');
const ExternalAPIHelper = require('../../utils/external-api');

/**
 * 勉強アシスタントコントローラー
 * カメラ機能、ノート分析、進捗管理、学習サポート
 */
class StudyController {
  
  /**
   * カメラでノート・資料を撮影・分析
   */
  async analyzeStudyMaterial(req, res) {
    try {
      const userId = req.user.userId;
      const { imageData, analysisType = 'general', subject } = req.body;
      
      // Base64画像データをバッファに変換
      const imageBuffer = Buffer.from(imageData, 'base64');
      
      // 画像分析処理（OCR + AI）
      const analysisResult = await this.performImageAnalysis(imageBuffer, analysisType);
      
      // 分析結果を保存
      const analysisRecord = {
        id: `analysis_${Date.now()}`,
        type: analysisType,
        subject: subject || 'unknown',
        extractedText: analysisResult.text,
        detectedElements: analysisResult.elements,
        suggestions: analysisResult.suggestions,
        timestamp: new Date().toISOString()
      };
      
      const User = require('../models/User');
      await User.updateOne(
        { userId },
        {
          $push: {
            'preferences.studyAnalyses': analysisRecord
          }
        },
        { upsert: true }
      );
      
      // WebSocket経由でリアルタイム結果送信
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('study_analysis_complete', {
          analysis: analysisRecord,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        analysis: analysisRecord,
        message: '分析が完了しました'
      });
    } catch (error) {
      logger.error('Failed to analyze study material:', error);
      res.status(500).json({
        success: false,
        error: 'AnalysisError',
        message: 'Failed to analyze study material'
      });
    }
  }
  
  /**
   * 学習進捗記録
   */
  async recordStudyProgress(req, res) {
    try {
      const userId = req.user.userId;
      const { 
        subject, 
        topic, 
        duration, 
        completedTasks, 
        difficulty, 
        understanding, 
        notes 
      } = req.body;
      
      const progressRecord = {
        id: `progress_${Date.now()}`,
        subject,
        topic,
        duration: duration || 0, // minutes
        completedTasks: completedTasks || [],
        difficulty: difficulty || 5, // 1-10 scale
        understanding: understanding || 5, // 1-10 scale
        notes: notes || '',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
      };
      
      const User = require('../models/User');
      await User.updateOne(
        { userId },
        {
          $push: {
            'preferences.studyProgress': progressRecord
          }
        },
        { upsert: true }
      );
      
      // 学習統計更新
      await this.updateStudyStats(userId, progressRecord);
      
      res.json({
        success: true,
        progress: progressRecord,
        message: '学習進捗を記録しました'
      });
    } catch (error) {
      logger.error('Failed to record study progress:', error);
      res.status(500).json({
        success: false,
        error: 'ProgressRecordError',
        message: 'Failed to record study progress'
      });
    }
  }
  
  /**
   * 学習セッション開始
   */
  async startStudySession(req, res) {
    try {
      const userId = req.user.userId;
      const { subject, goal, estimatedDuration } = req.body;
      
      const sessionId = `session_${Date.now()}`;
      const session = {
        id: sessionId,
        subject,
        goal,
        estimatedDuration: estimatedDuration || 60, // minutes
        startTime: new Date().toISOString(),
        status: 'active',
        breaks: [],
        interruptions: []
      };
      
      const User = require('../models/User');
      await User.updateOne(
        { userId },
        {
          $set: {
            'preferences.activeStudySession': session
          }
        },
        { upsert: true }
      );
      
      // WebSocket経由でセッション開始通知
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('study_session_started', {
          session,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        session,
        message: `${subject}の学習セッションを開始しました`
      });
    } catch (error) {
      logger.error('Failed to start study session:', error);
      res.status(500).json({
        success: false,
        error: 'SessionStartError',
        message: 'Failed to start study session'
      });
    }
  }
  
  /**
   * 学習セッション終了
   */
  async endStudySession(req, res) {
    try {
      const userId = req.user.userId;
      const { accomplishments, reflection, nextSteps } = req.body;
      
      const User = require('../models/User');
      const user = await User.findOne({ userId });
      const activeSession = user?.preferences?.activeStudySession;
      
      if (!activeSession) {
        return res.status(404).json({
          success: false,
          error: 'NoActiveSession',
          message: 'No active study session found'
        });
      }
      
      // セッション完了記録
      const completedSession = {
        ...activeSession,
        endTime: new Date().toISOString(),
        actualDuration: this.calculateSessionDuration(activeSession.startTime),
        accomplishments: accomplishments || [],
        reflection: reflection || '',
        nextSteps: nextSteps || [],
        status: 'completed'
      };
      
      await User.updateOne(
        { userId },
        {
          $unset: { 'preferences.activeStudySession': '' },
          $push: { 'preferences.completedStudySessions': completedSession }
        }
      );
      
      // 成果通知
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('study_session_completed', {
          session: completedSession,
          summary: this.generateSessionSummary(completedSession),
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        session: completedSession,
        summary: this.generateSessionSummary(completedSession),
        message: '学習セッションが完了しました'
      });
    } catch (error) {
      logger.error('Failed to end study session:', error);
      res.status(500).json({
        success: false,
        error: 'SessionEndError',
        message: 'Failed to end study session'
      });
    }
  }
  
  /**
   * 学習統計取得
   */
  async getStudyStats(req, res) {
    try {
      const userId = req.user.userId;
      const { period = 'week' } = req.query;
      
      const User = require('../models/User');
      const user = await User.findOne({ userId });
      
      const progressRecords = user?.preferences?.studyProgress || [];
      const completedSessions = user?.preferences?.completedStudySessions || [];
      
      // 期間でフィルタ
      const filteredData = this.filterDataByPeriod(
        { progressRecords, completedSessions }, 
        period
      );
      
      // 統計計算
      const stats = this.calculateStudyStats(filteredData);
      
      res.json({
        success: true,
        stats,
        period
      });
    } catch (error) {
      logger.error('Failed to get study stats:', error);
      res.status(500).json({
        success: false,
        error: 'StatsError',
        message: 'Failed to retrieve study statistics'
      });
    }
  }
  
  /**
   * 学習サポート・アドバイス
   */
  async getStudyAdvice(req, res) {
    try {
      const userId = req.user.userId;
      const { subject, currentTopic, difficulty } = req.query;
      
      const User = require('../models/User');
      const user = await User.findOne({ userId });
      
      // ユーザーの学習履歴を分析
      const learningPattern = await this.analyzeLearningPattern(user);
      
      // カスタマイズされたアドバイス生成
      const advice = this.generatePersonalizedAdvice(
        learningPattern, 
        { subject, currentTopic, difficulty }
      );
      
      res.json({
        success: true,
        advice,
        learningPattern: {
          preferredStudyTime: learningPattern.preferredTime,
          averageSessionLength: learningPattern.avgSessionLength,
          strongSubjects: learningPattern.strongSubjects,
          improvementAreas: learningPattern.improvementAreas
        }
      });
    } catch (error) {
      logger.error('Failed to get study advice:', error);
      res.status(500).json({
        success: false,
        error: 'AdviceError',
        message: 'Failed to generate study advice'
      });
    }
  }
  
  /**
   * 画像分析処理（OCR + AI）
   */
  async performImageAnalysis(imageBuffer, analysisType) {
    // 実装例：Tesseract.js for OCR + カスタムAI分析
    try {
      // OCR処理
      const extractedText = await this.performOCR(imageBuffer);
      
      // コンテンツ分析
      const elements = this.analyzeContent(extractedText, analysisType);
      
      // 学習提案生成
      const suggestions = this.generateStudySuggestions(extractedText, elements);
      
      return {
        text: extractedText,
        elements,
        suggestions
      };
    } catch (error) {
      logger.error('Image analysis failed:', error);
      return {
        text: '',
        elements: [],
        suggestions: ['画像分析に失敗しました。もう一度お試しください。']
      };
    }
  }
  
  /**
   * OCR処理（完全実装）
   */
  async performOCR(imageBuffer) {
    try {
      // External OCR service (Google Vision API, Azure Computer Vision, etc.)
      const ocrApiUrl = process.env.OCR_API_URL;
      
      if (ocrApiUrl) {
        return await this.callExternalOCR(ocrApiUrl, imageBuffer);
      }
      
      // Local Tesseract.js OCR
      try {
        return await this.performLocalTesseractOCR(imageBuffer);
      } catch (localError) {
        console.error('Local OCR failed:', localError);
        
        // AI-based OCR using vision model
        return await this.performAIBasedOCR(imageBuffer);
      }
    } catch (error) {
      console.error('All OCR methods failed:', error);
      return 'OCR処理に失敗しました。画像が不鮮明である可能性があります。';
    }
  }

  /**
   * External OCR API call
   */
  async callExternalOCR(ocrApiUrl, imageBuffer) {
    const base64Image = imageBuffer.toString('base64');
    
    const payload = {
      image: base64Image,
      language: 'ja+en',
      format: 'text',
      enhance: true
    };

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.OCR_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.OCR_API_KEY}`;
    }

    const response = await fetch(ocrApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OCR API failed: ${response.status}`);
    }

    const result = await response.json();
    return result.text || result.extracted_text || result.content || '';
  }

  /**
   * Local Tesseract.js OCR
   */
  async performLocalTesseractOCR(imageBuffer) {
    // Requires: npm install tesseract.js
    try {
      const Tesseract = require('tesseract.js');
      
      const { data: { text } } = await Tesseract.recognize(
        imageBuffer,
        'jpn+eng',
        {
          logger: m => console.log(`OCR Progress: ${m.status} ${m.progress}`)
        }
      );
      
      return text.trim();
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('Tesseract.js not installed. Install with: npm install tesseract.js');
        throw new Error('Tesseract.js not available');
      }
      throw error;
    }
  }

  /**
   * AI-based OCR using vision model
   */
  async performAIBasedOCR(imageBuffer) {
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;
    
    const visionApiUrl = process.env.LMSTUDIO_API_URL || 'http://127.0.0.1:8080/v1/chat/completions';
    
    const ocrRequest = {
      model: process.env.VISION_MODEL || 'llava-v1.6-mistral-7b-gguf',
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "この画像に書かれているテキストをすべて正確に抽出してください。レイアウトも保持してください。テキスト以外の説明は不要です。" 
            },
            { type: "image_url", image_url: { url: dataUri } }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    };

    const response = await fetch(visionApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ocrRequest)
    });

    if (!response.ok) {
      throw new Error(`Vision OCR failed: ${response.status}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
  }
  
  /**
   * コンテンツ分析
   */
  analyzeContent(text, analysisType) {
    const elements = [];
    
    // 数式検出
    if (text.includes('=') || /\d+[\+\-\*\/]\d+/.test(text)) {
      elements.push({ type: 'math', content: '数式が検出されました' });
    }
    
    // キーワード検出
    const keywords = text.match(/[A-Za-z]{3,}/g) || [];
    if (keywords.length > 0) {
      elements.push({ type: 'keywords', content: keywords.slice(0, 5) });
    }
    
    return elements;
  }
  
  /**
   * 学習提案生成
   */
  generateStudySuggestions(text, elements) {
    const suggestions = [];
    
    if (elements.some(e => e.type === 'math')) {
      suggestions.push('数式の解法手順を整理してみましょう');
      suggestions.push('類似問題を探して練習することをお勧めします');
    }
    
    if (elements.some(e => e.type === 'keywords')) {
      suggestions.push('重要な用語をまとめて単語帳を作成しましょう');
      suggestions.push('概念の関連性を図で表現してみましょう');
    }
    
    suggestions.push('定期的な復習スケジュールを設定しましょう');
    
    return suggestions;
  }
  
  /**
   * セッション時間計算
   */
  calculateSessionDuration(startTime) {
    const start = new Date(startTime);
    const end = new Date();
    return Math.round((end - start) / (1000 * 60)); // minutes
  }
  
  /**
   * セッション要約生成
   */
  generateSessionSummary(session) {
    return {
      totalTime: session.actualDuration,
      efficiency: session.actualDuration <= session.estimatedDuration ? 'Good' : 'Overtime',
      accomplishmentCount: session.accomplishments?.length || 0,
      recommendation: session.actualDuration > session.estimatedDuration * 1.5 
        ? '次回はより短い目標時間を設定することをお勧めします' 
        : '良いペースで学習できました！'
    };
  }
  
  /**
   * 学習統計更新
   */
  async updateStudyStats(userId, progressRecord) {
    // 日別・週別・月別統計の更新処理
    // 実装は簡略化
    logger.info(`Study stats updated for user ${userId}`);
  }
  
  /**
   * 期間フィルタ
   */
  filterDataByPeriod(data, period) {
    const now = new Date();
    let filterDate = new Date();
    
    if (period === 'week') {
      filterDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      filterDate.setMonth(now.getMonth() - 1);
    }
    
    return {
      progressRecords: data.progressRecords.filter(
        record => new Date(record.timestamp) >= filterDate
      ),
      completedSessions: data.completedSessions.filter(
        session => new Date(session.endTime) >= filterDate
      )
    };
  }
  
  /**
   * 学習統計計算
   */
  calculateStudyStats(data) {
    const { progressRecords, completedSessions } = data;
    
    return {
      totalStudyTime: completedSessions.reduce(
        (sum, session) => sum + session.actualDuration, 0
      ),
      sessionCount: completedSessions.length,
      averageSessionLength: completedSessions.length > 0 
        ? Math.round(completedSessions.reduce(
            (sum, session) => sum + session.actualDuration, 0
          ) / completedSessions.length) 
        : 0,
      subjectDistribution: this.calculateSubjectDistribution(progressRecords),
      understandingTrend: this.calculateUnderstandingTrend(progressRecords)
    };
  }
  
  /**
   * 科目分布計算
   */
  calculateSubjectDistribution(records) {
    const distribution = {};
    records.forEach(record => {
      distribution[record.subject] = (distribution[record.subject] || 0) + 1;
    });
    return distribution;
  }
  
  /**
   * 理解度推移計算
   */
  calculateUnderstandingTrend(records) {
    return records.map(record => ({
      date: record.date,
      understanding: record.understanding,
      subject: record.subject
    }));
  }
  
  /**
   * 学習パターン分析
   */
  async analyzeLearningPattern(user) {
    const sessions = user?.preferences?.completedStudySessions || [];
    
    return {
      preferredTime: this.findPreferredStudyTime(sessions),
      avgSessionLength: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + s.actualDuration, 0) / sessions.length 
        : 0,
      strongSubjects: this.identifyStrongSubjects(user),
      improvementAreas: this.identifyImprovementAreas(user)
    };
  }
  
  /**
   * 好みの学習時間分析
   */
  findPreferredStudyTime(sessions) {
    // 簡易実装：開始時間を分析
    const timeSlots = sessions.map(session => {
      const hour = new Date(session.startTime).getHours();
      if (hour < 12) return 'morning';
      if (hour < 18) return 'afternoon';
      return 'evening';
    });
    
    const counts = {};
    timeSlots.forEach(slot => {
      counts[slot] = (counts[slot] || 0) + 1;
    });
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'morning');
  }
  
  /**
   * 得意科目特定
   */
  identifyStrongSubjects(user) {
    const progress = user?.preferences?.studyProgress || [];
    const subjectScores = {};
    
    progress.forEach(record => {
      if (!subjectScores[record.subject]) {
        subjectScores[record.subject] = [];
      }
      subjectScores[record.subject].push(record.understanding);
    });
    
    const averages = {};
    Object.keys(subjectScores).forEach(subject => {
      const scores = subjectScores[subject];
      averages[subject] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    });
    
    return Object.keys(averages)
      .sort((a, b) => averages[b] - averages[a])
      .slice(0, 3);
  }
  
  /**
   * 改善エリア特定
   */
  identifyImprovementAreas(user) {
    const progress = user?.preferences?.studyProgress || [];
    const lowUnderstanding = progress
      .filter(record => record.understanding < 5)
      .map(record => record.subject);
    
    return [...new Set(lowUnderstanding)];
  }
  
  /**
   * パーソナライズドアドバイス生成
   */
  generatePersonalizedAdvice(pattern, context) {
    const advice = [];
    
    // 時間帯に応じたアドバイス
    if (pattern.preferredTime === 'morning') {
      advice.push('朝の集中力を活かして、難しい内容から取り組みましょう');
    } else if (pattern.preferredTime === 'evening') {
      advice.push('夜の学習では復習中心にすると効果的です');
    }
    
    // セッション長に応じたアドバイス
    if (pattern.avgSessionLength > 120) {
      advice.push('長時間の学習は素晴らしいですが、適度な休憩を挟みましょう');
    } else if (pattern.avgSessionLength < 30) {
      advice.push('もう少し長めの学習時間を設定してみましょう');
    }
    
    // 科目別アドバイス
    if (context.subject && pattern.improvementAreas.includes(context.subject)) {
      advice.push(`${context.subject}は苦手分野のようですね。基礎から丁寧に復習しましょう`);
    }
    
    advice.push('継続的な学習が最も重要です。毎日少しずつでも続けましょう');
    
    return advice;
  }
}

module.exports = new StudyController();
