const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'voice', 'image', 'file', 'command'],
    default: 'text'
  },
  metadata: {
    voice: {
      duration: Number, // seconds
      language: String,
      confidence: Number,
      transcript: String
    },
    image: {
      url: String,
      fileName: String,
      analysis: mongoose.Schema.Types.Mixed
    },
    context: {
      source: String, // 'chat_fragment', 'voice_input', etc.
      mode: String,
      location: {
        latitude: Number,
        longitude: Number
      }
    },
    processing: {
      responseTime: Number, // milliseconds
      tokensUsed: Number,
      model: String
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// インデックス
chatMessageSchema.index({ userId: 1, timestamp: -1 });
chatMessageSchema.index({ sessionId: 1, timestamp: 1 });
chatMessageSchema.index({ messageId: 1 });

// 静的メソッド
chatMessageSchema.statics.getChatHistory = function(userId, sessionId = null, limit = 50) {
  const filter = { userId, isDeleted: false };
  if (sessionId) filter.sessionId = sessionId;
  
  return this.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit);
};

chatMessageSchema.statics.getConversationContext = function(userId, limit = 10) {
  return this.find({ userId, isDeleted: false })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('role content timestamp sessionId');
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
