/**
 * LumiMei OS Memory Controller
 * メモリ検索・参照機能
 */

// Mock memory data for testing
const mockMemoryData = [
  {
    id: 'mem_001',
    userId: 'user_001',
    content: '前回の睡眠アドバイス: 毎日同じ時間に寝ることが重要です。',
    type: 'advice',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    relevance: 0.95,
    tags: ['睡眠', 'アドバイス', '健康']
  },
  {
    id: 'mem_002',
    userId: 'user_001',
    content: '睡眠時間を7-8時間確保することで、翌日のパフォーマンスが向上します。',
    type: 'knowledge',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    relevance: 0.88,
    tags: ['睡眠', '健康', 'パフォーマンス']
  },
  {
    id: 'mem_003',
    userId: 'user_001',
    content: 'ブルーライトを避けて、就寝1時間前からスクリーンを見ないようにしましょう。',
    type: 'tip',
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    relevance: 0.82,
    tags: ['睡眠', 'ブルーライト', 'デジタルデトックス']
  }
];

// 5) メモリ検索・参照
const queryMemory = async (req, res) => {
  try {
    console.log('Memory query request:', JSON.stringify(req.body, null, 2));

    const {
      userId,
      query,
      k = 5,
      types = [],
      timeRange = null
    } = req.body;

    // Validate required fields
    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId and query are required'
        }
      });
    }

    // Simple text matching for mock implementation
    const filteredMemories = mockMemoryData
      .filter(mem => mem.userId === userId)
      .filter(mem => {
        const queryLower = query.toLowerCase();
        const contentLower = mem.content.toLowerCase();
        const tagsLower = mem.tags.join(' ').toLowerCase();
        return contentLower.includes(queryLower) || tagsLower.includes(queryLower);
      })
      .filter(mem => types.length === 0 || types.includes(mem.type))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, k);

    // Generate summary
    const summary = filteredMemories.length > 0
      ? `${query}に関連する${filteredMemories.length}件の記憶を見つけました。`
      : `${query}に関連する記憶は見つかりませんでした。`;

    const response = {
      success: true,
      query,
      summary,
      results: filteredMemories.map(mem => ({
        id: mem.id,
        content: mem.content,
        type: mem.type,
        relevance: mem.relevance,
        timestamp: mem.timestamp,
        tags: mem.tags
      })),
      meta: {
        total: filteredMemories.length,
        k,
        processingTime: Math.random() * 50 + 10
      }
    };

    console.log('Memory query completed successfully');
    res.status(200).json(response);

  } catch (error) {
    console.error('Memory query error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_ERROR',
        message: 'Failed to query memory'
      }
    });
  }
};

// Store new memory
const storeMemory = async (req, res) => {
  try {
    const {
      userId,
      content,
      type = 'general',
      tags = [],
      importance = 0.5
    } = req.body;

    if (!userId || !content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId and content are required'
        }
      });
    }

    const newMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      content,
      type,
      tags,
      importance,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // Mock storage (in real implementation, save to database)
    mockMemoryData.push(newMemory);

    res.status(201).json({
      success: true,
      message: 'Memory stored successfully',
      data: {
        id: newMemory.id,
        timestamp: newMemory.timestamp
      }
    });

  } catch (error) {
    console.error('Memory store error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_ERROR',
        message: 'Failed to store memory'
      }
    });
  }
};

// Get memory by ID
const getMemory = async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { userId } = req.query;

    const memory = mockMemoryData.find(mem => 
      mem.id === memoryId && mem.userId === userId
    );

    if (!memory) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Memory not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: memory
    });

  } catch (error) {
    console.error('Memory get error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_ERROR',
        message: 'Failed to retrieve memory'
      }
    });
  }
};

module.exports = {
  queryMemory,
  storeMemory,
  getMemory
};
