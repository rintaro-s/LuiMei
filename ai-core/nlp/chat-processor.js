const crypto = require('crypto');

class ChatProcessor {
  constructor() {
    this.conversationContext = new Map();
    this.responsePatterns = this.initializeResponsePatterns();
  }

  async processMessage(data) {
    const { userId, message, context, personality = {}, memory = [] } = data;
    
    try {
      // client.py互換フォーマットの処理
      const startTime = Date.now();
      
      // 基本的な感情分析
      const emotion = this.analyzeEmotions(message);
      
      // personalityとmemoryを統合
      const enhancedPersonality = this.enhancePersonalityWithMemory(personality, memory);
      
      // メッセージ分析
      const messageAnalysis = this.analyzeMessage(message, context);
      
      // role_sheetの決定
      const roleSheet = this.determineRoleSheet(enhancedPersonality, messageAnalysis, context);
      
      // 応答生成
      const response = await this.generateResponseText({
        message,
        analysis: messageAnalysis,
        personality: enhancedPersonality,
        memory,
        context,
        roleSheet
      });
      
      // 感情状態の計算
      const emotions = this.calculateEmotionalResponse(messageAnalysis, enhancedPersonality, context);
      
      const processingTime = Date.now() - startTime;
      
      // client.py互換のレスポンス形式
      return {
        response: response,
        role_sheet: roleSheet,
        emotions: emotions,
        status: 'success',
        metadata: {
          messageId: this.generateMessageId(),
          timestamp: new Date().toISOString(),
          confidence: 0.85,
          processingTime: processingTime
        }
      };
      
    } catch (error) {
      console.error('Chat processing error:', error);
      return {
        response: "申し訳ございません。処理中にエラーが発生しました。",
        role_sheet: { role: "assistant", mood: "apologetic" },
        emotions: { concern: 0.8, empathy: 0.7 },
        status: 'error',
        error: error.message
      };
    }
  }

  // === client.py互換の新しいメソッド群 ===

  analyzeMessage(message, context = {}) {
    return {
      sentiment: this.analyzeSentiment(message),
      intent: this.extractIntent(message),
      entities: this.extractEntities(message),
      emotions: this.analyzeEmotions(message),
      topics: this.extractTopics(message),
      urgency: this.assessUrgency(message),
      complexity: this.assessComplexity(message)
    };
  }

  analyzeEmotions(message) {
    return {
      joy: this.countEmotionWords(message, ['嬉しい', '楽しい', '幸せ']) * 0.3,
      sadness: this.countEmotionWords(message, ['悲しい', '辛い', '寂しい']) * 0.3,
      anger: this.countEmotionWords(message, ['怒り', '腹立つ', 'むかつく']) * 0.3,
      surprise: this.countEmotionWords(message, ['驚き', 'びっくり', '意外']) * 0.3,
      neutral: 0.4
    };
  }

  enhancePersonalityWithMemory(personality, memory) {
    const enhanced = { ...personality };
    if (memory && memory.length > 0) {
      const recentMemory = memory.slice(-10);
      enhanced.learnedPreferences = this.extractPreferencesFromMemory(recentMemory);
      enhanced.communicationStyle = this.inferCommunicationStyle(recentMemory);
      enhanced.relationshipLevel = this.assessRelationshipLevel(memory);
    }
    return enhanced;
  }

  determineRoleSheet(personality, messageAnalysis, context) {
    const baseRole = personality.basePersonality || "friendly_assistant";
    const mood = this.determineMood(messageAnalysis, personality);
    const responseStyle = this.determineResponseStyle(messageAnalysis, personality);

    return {
      role: baseRole,
      mood,
      responseStyle,
      adaptations: this.getPersonalityAdaptations(personality, messageAnalysis)
    };
  }

  async generateResponseText({ message, analysis, personality, memory, context, roleSheet }) {
    const template = this.selectResponseTemplate(analysis, roleSheet);
    let response = this.selectFromTemplate(template, analysis);
    
    response = this.adjustForPersonality(response, personality, roleSheet);
    response = this.incorporateMemoryContext(response, memory, message);
    response = this.addEmotionalNuance(response, analysis.emotions, roleSheet.mood);
    
    return response;
  }

  calculateEmotionalResponse(analysis, personality, context) {
    return { 
      warmth: 0.7, 
      understanding: 0.8, 
      engagement: 0.6,
      empathy: analysis.emotions.sadness * 0.8 + 0.2
    };
  }

  // === ヘルパーメソッド群 ===

  analyzeSentiment(message) {
    const positiveWords = ['嬉しい', '楽しい', 'ありがとう', '良い', '素晴らしい'];
    const negativeWords = ['悲しい', '辛い', '困った', '嫌', '疲れた'];
    
    let score = 0;
    positiveWords.forEach(word => {
      if (message.includes(word)) score += 1;
    });
    negativeWords.forEach(word => {
      if (message.includes(word)) score -= 1;
    });

    return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  }

  countEmotionWords(message, words) {
    return words.reduce((count, word) => {
      return count + (message.includes(word) ? 1 : 0);
    }, 0);
  }

  initializeResponsePatterns() {
    return {
      greeting: [
        "こんにちは！今日はどのようなことをお話ししましょうか？",
        "お疲れ様です！何かお手伝いできることはありますか？"
      ],
      question: [
        "興味深い質問ですね。",
        "それについて一緒に考えてみましょう。",
        "良い質問です！"
      ],
      default: [
        "なるほど、そうですね。",
        "そのお気持ち、よく分かります。",
        "そういうこともありますよね。"
      ]
    };
  }

  selectFromTemplate(template, analysis) {
    const patterns = this.responsePatterns[template] || this.responsePatterns.default;
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  adjustForPersonality(response, personality, roleSheet) {
    if (personality.warmth > 0.7) {
      response += " 😊";
    }
    if (personality.formality > 0.7) {
      response = response.replace(/だね/g, "ですね");
    }
    return response;
  }

  incorporateMemoryContext(response, memory, currentMessage) {
    if (memory && memory.length > 0) {
      const recentTopics = memory.slice(-3).map(m => m.topic).filter(Boolean);
      if (recentTopics.length > 0 && Math.random() > 0.7) {
        const relatedTopic = recentTopics[0];
        response += ` そういえば、先ほど${relatedTopic}の話をしていましたね。`;
      }
    }
    return response;
  }

  addEmotionalNuance(response, emotions, mood) {
    if (mood === 'empathetic' && emotions.sadness > 0.5) {
      response = "そんな気持ちになることもありますよね。" + response;
    }
    return response;
  }

  generateMessageId() { 
    return crypto.randomUUID(); 
  }

  // その他のヘルパーメソッド（簡易実装）
  extractIntent(message) {
    const intents = {
      question: ['？', '?', 'どう', 'なぜ', 'いつ', 'どこ', '教えて'],
      request: ['して', 'ください', 'お願い', 'してくれ'],
      greeting: ['こんにちは', 'おはよう', 'こんばんは', 'はじめまして'],
      farewell: ['さようなら', 'また', 'バイバイ', 'おやすみ']
    };

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        return intent;
      }
    }
    return 'statement';
  }

  extractEntities(message) { return []; }
  extractTopics(message) { return []; }
  assessUrgency(message) { return 'normal'; }
  assessComplexity(message) { return 'medium'; }
  extractPreferencesFromMemory(memory) { return {}; }
  inferCommunicationStyle(memory) { return 'balanced'; }
  assessRelationshipLevel(memory) { return 'developing'; }
  determineMood(analysis, personality) { return 'friendly'; }
  determineResponseStyle(analysis, personality) { return 'conversational'; }
  getPersonalityAdaptations(personality, analysis) { return {}; }
  selectResponseTemplate(analysis, roleSheet) { return analysis.intent || 'default'; }
}

module.exports = new ChatProcessor();
