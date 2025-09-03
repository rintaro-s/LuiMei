/**
 * LumiMei OS Chat Controller - SIMPLIFIED VERSION
 * client.py互換チャット処理API
 */

// Helper function to generate mock responses
function generateMockResponse(text, roleSheet = {}, history = []) {
  const responses = [
    'おはようございます！今日も素晴らしい一日になりそうですね。',
    'それは興味深い話ですね。もう少し詳しく教えてください。',
    'わかりました！すぐにお手伝いします。何か他にも必要なことはありますか？',
    'そうですね、その通りだと思います。一緒に考えてみましょう。',
    'ありがとうございます！あなたとお話しできて本当に楽しいです。'
  ];

  // Generate response based on input text
  if (text.includes('おはよう') || text.includes('こんにちは')) {
    return {
      text: 'おはようございます！今日はどんなご予定ですか？お手伝いできることがあれば教えてください。',
      emotion: 'energetic',
      confidence: 0.92
    };
  }
  
  if (text.includes('予定') || text.includes('スケジュール')) {
    return {
      text: '今日の予定について教えてください。時間管理のお手伝いをさせていただきます！',
      emotion: 'helpful',
      confidence: 0.88
    };
  }

  // Default response
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  return {
    text: randomResponse,
    emotion: roleSheet?.mood || 'friendly',
    confidence: 0.85
  };
}

// Process chat endpoint - CLIENT.PY COMPATIBLE
const processChat = async (req, res) => {
  try {
    console.log('Chat processing request received:', JSON.stringify(req.body, null, 2));
    
    const { 
      text, 
      role_sheet = {}, 
      history = [], 
      compressed_memory = '',
      options = {}
    } = req.body;

    // Validate required fields
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a non-empty string'
      });
    }

    // Generate mock response
    const mockResponse = generateMockResponse(text, role_sheet, history);

    // Create response data compatible with client.py
    const responseData = {
      response: mockResponse.text,
      emotion: {
        dominant: mockResponse.emotion,
        confidence: mockResponse.confidence,
        secondary: 'calm'
      },
      role_sheet: {
        role: role_sheet.role || 'assistant',
        mood: role_sheet.mood || mockResponse.emotion,
        personality: role_sheet.personality || 'friendly'
      },
      history: [
        ...history,
        {
          role: 'user',
          content: text,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant', 
          content: mockResponse.text,
          timestamp: new Date().toISOString(),
          emotion: mockResponse.emotion
        }
      ],
      compressed_memory: compressed_memory || 'Mock memory content',
      metadata: {
        processingTime: Math.random() * 150 + 50,
        timestamp: new Date().toISOString(),
        model: 'lumimei-chat-mock-v1',
        tokens: {
          input: text.length,
          output: mockResponse.text.length
        }
      },
      debug: options.includeDebug ? {
        inputAnalysis: {
          intent: 'general_conversation',
          sentiment: 'positive',
          keywords: text.split(' ').slice(0, 3)
        },
        responseGeneration: {
          strategy: 'template_based',
          selectedTemplate: 'friendly_response'
        }
      } : undefined
    };

    console.log('Chat processed successfully');

    res.status(200).json({
      success: true,
      ...responseData
    });

  } catch (error) {
    console.error('Chat processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Chat processing failed',
      message: error.message
    });
  }
};

// Get chat history - MOCK IMPLEMENTATION
const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const mockHistory = [
      {
        messageId: 'msg_001',
        role: 'user',
        content: 'こんにちは',
        timestamp: new Date(Date.now() - 300000).toISOString()
      },
      {
        messageId: 'msg_002',
        role: 'assistant',
        content: 'こんにちは！今日はどんなことをお話ししましょうか？',
        timestamp: new Date(Date.now() - 280000).toISOString(),
        emotion: 'friendly'
      },
      {
        messageId: 'msg_003',
        role: 'user',
        content: '今日の天気はどうですか？',
        timestamp: new Date(Date.now() - 200000).toISOString()
      },
      {
        messageId: 'msg_004',
        role: 'assistant',
        content: '今日はとても良い天気ですね！外出日和です。',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        emotion: 'cheerful'
      }
    ];

    const paginatedHistory = mockHistory.slice(offset, offset + limit);

    res.status(200).json({
      success: true,
      data: {
        history: paginatedHistory,
        total: mockHistory.length,
        offset: parseInt(offset),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
};

// Clear chat history - MOCK IMPLEMENTATION
const clearChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    res.status(200).json({
      success: true,
      message: `Chat history cleared for user ${userId}`,
      data: {
        clearedAt: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear chat history'
    });
  }
};

// Send message - MOCK IMPLEMENTATION
const sendMessage = async (req, res) => {
  try {
    const { message, context } = req.body;
    
    const response = generateMockResponse(message, {}, []);

    res.status(200).json({
      success: true,
      response: response.text,
      metadata: {
        processingTime: Math.random() * 100 + 50,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Message send failed'
    });
  }
};

// Search chat history - MOCK IMPLEMENTATION
const searchChatHistory = async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    const mockResults = [
      {
        messageId: 'msg_001',
        content: '検索にマッチしたメッセージです',
        timestamp: new Date().toISOString(),
        relevance: 0.95
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        results: mockResults,
        query,
        total: mockResults.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
};

// Get compressed memory - MOCK IMPLEMENTATION
const getCompressedMemory = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        compressedMemory: 'Mock compressed memory content',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Memory fetch failed'
    });
  }
};

// Compress memory - MOCK IMPLEMENTATION
const compressMemory = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Memory compressed successfully',
      data: {
        compressedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Memory compression failed'
    });
  }
};

// Clear memory - MOCK IMPLEMENTATION
const clearMemory = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Memory cleared successfully',
      data: {
        clearedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Memory clear failed'
    });
  }
};

module.exports = {
  processChat,
  getChatHistory,
  clearChatHistory,
  sendMessage,
  searchChatHistory,
  getCompressedMemory,
  compressMemory,
  clearMemory
};
