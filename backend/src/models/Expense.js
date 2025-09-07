const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['食費', '交通費', '住居費', '光熱費', '通信費', '医療費', '娯楽費', '教育費', '衣服費', '日用品', '投資', 'その他'],
    default: 'その他'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['現金', 'クレジットカード', 'デビットカード', '電子マネー', '口座振替', 'その他'],
    default: 'その他'
  },
  source: {
    type: String,
    enum: ['manual', 'receipt', 'bank_import', 'api'],
    default: 'manual'
  },
  tags: [String],
  location: {
    name: String,
    latitude: Number,
    longitude: Number
  },
  receiptImage: {
    url: String,
    fileName: String,
    analysisResult: {
      confidence: Number,
      extractedData: mongoose.Schema.Types.Mixed
    }
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
    interval: { type: Number, min: 1 },
    endDate: Date
  },
  attachments: [{
    fileName: String,
    url: String,
    type: { type: String, enum: ['image', 'pdf', 'document'] }
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// インデックス
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, createdAt: -1 });

// 静的メソッド
expenseSchema.statics.getExpensesByUser = function(userId, startDate, endDate) {
  const filter = { userId };
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }
  return this.find(filter).sort({ date: -1 });
};

expenseSchema.statics.getMonthlyTotal = function(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        userId: userId,
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

expenseSchema.statics.getCategoryTotals = function(userId, startDate, endDate) {
  const matchFilter = { userId };
  if (startDate || endDate) {
    matchFilter.date = {};
    if (startDate) matchFilter.date.$gte = new Date(startDate);
    if (endDate) matchFilter.date.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    { $sort: { total: -1 } }
  ]);
};

module.exports = mongoose.model('Expense', expenseSchema);
