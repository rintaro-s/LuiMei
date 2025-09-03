const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Interaction record
  sessionId: {
    type: String,
    required: true
  },
  
  userMessage: {
    type: String,
    required: true
  },
  
  aiResponse: {
    type: String,
    required: true
  },
  
  // Context and metadata
  emotion: {
    dominant: String,
    confidence: Number,
    emotions: mongoose.Schema.Types.Mixed
  },
  
  personality: {
    name: String,
    traits: [String],
    voiceStyle: String,
    responseStyle: String
  },
  
  context: {
    location: String,
    timeOfDay: Number,
    deviceType: String,
    additionalContext: mongoose.Schema.Types.Mixed
  },
  
  // Memory management
  importance: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 10
  },
  
  tags: [String],
  
  isCompressed: {
    type: Boolean,
    default: false
  },
  
  compressedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompressedMemory'
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
memorySchema.index({ userId: 1, timestamp: -1 });
memorySchema.index({ userId: 1, sessionId: 1 });
memorySchema.index({ userId: 1, tags: 1 });
memorySchema.index({ userId: 1, importance: -1 });

const compressedMemorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Compressed content
  summary: {
    type: String,
    required: true
  },
  
  keyPoints: [String],
  
  emotionalProfile: {
    dominantEmotions: [String],
    personalityInsights: [String],
    preferredTopics: [String]
  },
  
  // Time range this compression covers
  startTime: {
    type: Date,
    required: true
  },
  
  endTime: {
    type: Date,
    required: true
  },
  
  // Original interactions count
  originalCount: {
    type: Number,
    required: true
  },
  
  // Compression metadata
  compressionLevel: {
    type: String,
    enum: ['light', 'medium', 'heavy'],
    default: 'medium'
  },
  
  compressionAlgorithm: {
    type: String,
    default: 'summarization'
  },
  
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

compressedMemorySchema.index({ userId: 1, timestamp: -1 });

class MemoryService {
  constructor() {
    this.Memory = mongoose.model('Memory', memorySchema);
    this.CompressedMemory = mongoose.model('CompressedMemory', compressedMemorySchema);
  }

  async saveInteraction(userId, interactionData) {
    try {
      const memory = new this.Memory({
        userId,
        ...interactionData,
        importance: this.calculateImportance(interactionData),
        tags: this.extractTags(interactionData)
      });

      await memory.save();
      return memory;

    } catch (error) {
      console.error('Error saving interaction:', error);
      throw error;
    }
  }

  async getChatHistory(userId, options = {}) {
    const { limit = 50, offset = 0, sessionId } = options;

    try {
      const query = { userId };
      if (sessionId) query.sessionId = sessionId;

      const memories = await this.Memory
        .find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      return memories.map(memory => ({
        role: 'user',
        content: memory.userMessage,
        timestamp: memory.timestamp
      }).concat({
        role: 'assistant',
        content: memory.aiResponse,
        timestamp: memory.timestamp,
        emotion: memory.emotion
      })).flat();

    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  async searchChatHistory(userId, searchQuery, options = {}) {
    const { limit = 20 } = options;

    try {
      const memories = await this.Memory
        .find({
          userId,
          $or: [
            { userMessage: { $regex: searchQuery, $options: 'i' } },
            { aiResponse: { $regex: searchQuery, $options: 'i' } },
            { tags: { $in: [new RegExp(searchQuery, 'i')] } }
          ]
        })
        .sort({ importance: -1, timestamp: -1 })
        .limit(limit)
        .lean();

      return memories;

    } catch (error) {
      console.error('Error searching chat history:', error);
      throw error;
    }
  }

  async clearChatHistory(userId, before = null) {
    try {
      const query = { userId };
      if (before) {
        query.timestamp = { $lt: new Date(before) };
      }

      const result = await this.Memory.deleteMany(query);
      return result.deletedCount;

    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw error;
    }
  }

  async getCompressedMemory(userId) {
    try {
      const compressed = await this.CompressedMemory
        .findOne({ userId })
        .sort({ timestamp: -1 });

      return compressed ? compressed.summary : null;

    } catch (error) {
      console.error('Error getting compressed memory:', error);
      return null;
    }
  }

  async updateCompressedMemory(userId, newUserMessage, newAiResponse) {
    try {
      // Simple implementation: append to existing compressed memory
      const existingCompressed = await this.getCompressedMemory(userId);
      
      const newSummary = existingCompressed 
        ? `${existingCompressed}\n\nRecent: User said "${newUserMessage}" and AI responded "${newAiResponse}"`
        : `User said "${newUserMessage}" and AI responded "${newAiResponse}"`;

      // Keep compressed memory manageable (max 1000 chars)
      const truncatedSummary = newSummary.length > 1000 
        ? '...' + newSummary.slice(-1000)
        : newSummary;

      return truncatedSummary;

    } catch (error) {
      console.error('Error updating compressed memory:', error);
      return null;
    }
  }

  async compressRecentMemory(userId) {
    try {
      // Get recent uncompressed memories
      const recentMemories = await this.Memory
        .find({ 
          userId, 
          isCompressed: false,
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        })
        .sort({ timestamp: 1 });

      if (recentMemories.length === 0) {
        return await this.getCompressedMemory(userId);
      }

      // Simple compression: create summary
      const summary = this.createSummary(recentMemories);
      
      const compressed = new this.CompressedMemory({
        userId,
        summary,
        keyPoints: this.extractKeyPoints(recentMemories),
        emotionalProfile: this.analyzeEmotionalProfile(recentMemories),
        startTime: recentMemories[0].timestamp,
        endTime: recentMemories[recentMemories.length - 1].timestamp,
        originalCount: recentMemories.length
      });

      await compressed.save();

      // Mark original memories as compressed
      await this.Memory.updateMany(
        { _id: { $in: recentMemories.map(m => m._id) } },
        { isCompressed: true, compressedInto: compressed._id }
      );

      return compressed.summary;

    } catch (error) {
      console.error('Error compressing memory:', error);
      throw error;
    }
  }

  async clearMemory(userId) {
    try {
      await Promise.all([
        this.Memory.deleteMany({ userId }),
        this.CompressedMemory.deleteMany({ userId })
      ]);

    } catch (error) {
      console.error('Error clearing memory:', error);
      throw error;
    }
  }

  // Helper methods
  calculateImportance(interactionData) {
    let importance = 1.0;

    // Boost importance based on emotion intensity
    if (interactionData.emotion?.confidence > 0.8) {
      importance += 1.0;
    }

    // Boost for longer messages
    if (interactionData.userMessage?.length > 100) {
      importance += 0.5;
    }

    // Boost for questions
    if (interactionData.userMessage?.includes('?')) {
      importance += 0.3;
    }

    return Math.min(importance, 10.0);
  }

  extractTags(interactionData) {
    const tags = [];
    const message = interactionData.userMessage?.toLowerCase() || '';

    // Emotion tags
    if (interactionData.emotion?.dominant) {
      tags.push(`emotion:${interactionData.emotion.dominant}`);
    }

    // Topic tags (simple keyword detection)
    const topics = {
      weather: ['天気', '晴れ', '雨', '曇り'],
      music: ['音楽', '歌', '曲'],
      time: ['時間', '時刻', '今'],
      device: ['照明', 'ライト', 'テレビ', 'エアコン']
    };

    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        tags.push(`topic:${topic}`);
      }
    }

    return tags;
  }

  createSummary(memories) {
    const topics = new Set();
    const emotions = new Set();
    
    memories.forEach(memory => {
      memory.tags?.forEach(tag => {
        if (tag.startsWith('topic:')) topics.add(tag.replace('topic:', ''));
        if (tag.startsWith('emotion:')) emotions.add(tag.replace('emotion:', ''));
      });
    });

    return `Conversation summary (${memories.length} interactions): ` +
           `Topics discussed: ${Array.from(topics).join(', ')}. ` +
           `Emotions observed: ${Array.from(emotions).join(', ')}.`;
  }

  extractKeyPoints(memories) {
    // Simple implementation: extract high-importance messages
    return memories
      .filter(m => m.importance > 2.0)
      .map(m => m.userMessage)
      .slice(0, 5);
  }

  analyzeEmotionalProfile(memories) {
    const emotions = {};
    
    memories.forEach(memory => {
      if (memory.emotion?.dominant) {
        emotions[memory.emotion.dominant] = (emotions[memory.emotion.dominant] || 0) + 1;
      }
    });

    const dominantEmotions = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion]) => emotion);

    return {
      dominantEmotions,
      personalityInsights: ['Consistent interaction pattern'],
      preferredTopics: []
    };
  }

  /**
   * Clear user's memory data
   */
  async clearUserMemory(userId, before = null) {
    try {
      const filter = { userId };
      if (before) {
        filter.timestamp = { $lt: new Date(before) };
      }

      // Clear regular memory
      await this.Memory.deleteMany(filter);

      // Clear compressed memory
      await this.CompressedMemory.deleteMany(filter);

      console.log(`Cleared memory for user ${userId}${before ? ` before ${before}` : ''}`);
      return true;

    } catch (error) {
      console.error('Error clearing user memory:', error);
      throw error;
    }
  }
}

module.exports = new MemoryService();
