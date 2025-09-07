const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // minutes
    min: 0
  },
  targetDuration: {
    type: Number, // minutes
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active'
  },
  progress: {
    completedTasks: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 1 },
    percentComplete: { type: Number, min: 0, max: 100, default: 0 }
  },
  materials: [{
    type: { type: String, enum: ['image', 'text', 'pdf', 'video', 'audio', 'url'] },
    content: String, // base64 for images, text content, or URL
    fileName: String,
    analysis: {
      confidence: Number,
      extractedText: String,
      keyPoints: [String],
      difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
      estimatedTime: Number // minutes
    }
  }],
  notes: [{
    timestamp: { type: Date, default: Date.now },
    content: String,
    type: { type: String, enum: ['note', 'question', 'important', 'review'] }
  }],
  goals: [{
    description: String,
    isCompleted: { type: Boolean, default: false },
    completedAt: Date
  }],
  breaks: [{
    startTime: Date,
    endTime: Date,
    duration: Number, // minutes
    type: { type: String, enum: ['short', 'long', 'meal'] }
  }],
  statistics: {
    focusTime: { type: Number, default: 0 }, // minutes actually focused
    breakTime: { type: Number, default: 0 }, // minutes on break
    distractions: { type: Number, default: 0 },
    questionsAsked: { type: Number, default: 0 },
    materialsCovered: { type: Number, default: 0 }
  },
  feedback: {
    difficulty: { type: Number, min: 1, max: 5 },
    satisfaction: { type: Number, min: 1, max: 5 },
    understanding: { type: Number, min: 1, max: 5 },
    comments: String
  },
  tags: [String],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// インデックス
studySessionSchema.index({ userId: 1, startTime: -1 });
studySessionSchema.index({ userId: 1, status: 1 });
studySessionSchema.index({ sessionId: 1 });

// セッション完了時の処理
studySessionSchema.methods.completeSession = function(feedback = {}) {
  this.endTime = new Date();
  this.duration = Math.floor((this.endTime - this.startTime) / 60000); // minutes
  this.status = 'completed';
  this.progress.percentComplete = 100;
  
  if (feedback) {
    this.feedback = { ...this.feedback, ...feedback };
  }
  
  return this.save();
};

// 休憩追加
studySessionSchema.methods.addBreak = function(breakType = 'short') {
  const now = new Date();
  this.breaks.push({
    startTime: now,
    type: breakType
  });
  return this.save();
};

// 休憩終了
studySessionSchema.methods.endBreak = function() {
  const lastBreak = this.breaks[this.breaks.length - 1];
  if (lastBreak && !lastBreak.endTime) {
    lastBreak.endTime = new Date();
    lastBreak.duration = Math.floor((lastBreak.endTime - lastBreak.startTime) / 60000);
    this.statistics.breakTime += lastBreak.duration;
    return this.save();
  }
};

// 進捗更新
studySessionSchema.methods.updateProgress = function(completedTasks, totalTasks) {
  this.progress.completedTasks = completedTasks;
  this.progress.totalTasks = totalTasks;
  this.progress.percentComplete = totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;
  return this.save();
};

// 静的メソッド
studySessionSchema.statics.getActiveSession = function(userId) {
  return this.findOne({ userId, status: 'active' });
};

studySessionSchema.statics.getUserSessions = function(userId, limit = 20) {
  return this.find({ userId })
    .sort({ startTime: -1 })
    .limit(limit);
};

studySessionSchema.statics.getSessionStats = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: userId,
        startTime: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalMinutes: { $sum: '$duration' },
        avgDuration: { $avg: '$duration' },
        totalFocusTime: { $sum: '$statistics.focusTime' },
        avgSatisfaction: { $avg: '$feedback.satisfaction' },
        subjects: { $addToSet: '$subject' }
      }
    }
  ]);
};

module.exports = mongoose.model('StudySession', studySessionSchema);
