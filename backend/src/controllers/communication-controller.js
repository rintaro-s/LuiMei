/**
 * LumiMei OS Communication Controller - SIMPLIFIED MOCK VERSION
 * readme_app.md仕様に対応した通信API
 */

// Helper function to generate mock responses
function generateMockResponse(message, context = {}) {
  const responses = [
    'こんにちは！とても嬉しいです。今日はどんなことをお手伝いできるでしょうか？',
    'それは面白い質問ですね！一緒に考えてみましょう。',
    'わかりました！すぐにお手伝いします。他に何か必要なことはありますか？',
    'そうですね、その通りだと思います。詳しくお聞かせください。',
    'ありがとうございます！あなたとお話しできて本当に楽しいです。'
  ];

  // Simple response based on message content
  if (message.includes('こんにちは') || message.includes('おはよう')) {
    return 'こんにちは！今日もお会いできて嬉しいです。どんなことをお話ししましょうか？';
  }
  
  if (message.includes('天気') || message.includes('予定')) {
    return '今日は' + (context?.mood === 'happy' ? '素晴らしい' : 'いい') + '日ですね！予定について教えてください。';
  }

  // Random response
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate unique message ID
function generateMessageId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Send message endpoint - SIMPLIFIED VERSION
const sendMessage = async (req, res) => {
  try {
    console.log('Message request received:', JSON.stringify(req.body, null, 2));
    
    const { userId, message, messageType, context, options } = req.body;

    // Validate required fields
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Generate message ID
    const messageId = generateMessageId();

    // Generate mock AI response
    const mockResponse = generateMockResponse(message, context);

    // Prepare response
    const responseData = {
      messageId,
      response: {
        content: mockResponse,
        messageType: 'text',
        emotion: {
          dominant: 'friendly',
          confidence: 0.85
        }
      },
      context: {
        sessionId: 'session_' + Date.now(),
        mood: context?.mood || 'neutral',
        ...context
      },
      metadata: {
        processingTime: Math.random() * 100 + 50,
        timestamp: new Date().toISOString(),
        model: 'lumimei-mock-v1'
      }
    };

    console.log('Message processed successfully');

    res.status(200).json({
      success: true,
      ...responseData
    });

  } catch (error) {
    console.error('Communication error:', error);
    res.status(500).json({
      success: false,
      error: 'Message processing failed',
      message: error.message
    });
  }
};

// Handle voice input - SIMPLIFIED VERSION
const handleVoiceInput = async (req, res) => {
  try {
    console.log('Voice input request received');
    
    const { userId, audioData, format, options } = req.body;

    // Mock voice transcription
    const transcription = 'こんにちは、今日はいい天気ですね。何かお手伝いできることはありますか？';
    
    // Generate response to transcribed text
    const mockResponse = generateMockResponse(transcription);

    const responseData = {
      transcription,
      confidence: 0.92,
      response: {
        content: mockResponse,
        messageType: 'text',
        emotion: {
          dominant: 'friendly',
          confidence: 0.88
        }
      },
      metadata: {
        processingTime: Math.random() * 200 + 100,
        timestamp: new Date().toISOString(),
        audioFormat: format || 'wav',
        language: options?.language || 'ja-JP'
      }
    };

    res.status(200).json({
      success: true,
      ...responseData
    });

  } catch (error) {
    console.error('Voice input error:', error);
    res.status(500).json({
      success: false,
      error: 'Voice processing failed',
      message: error.message
    });
  }
};

// Analyze image - SIMPLIFIED VERSION
const analyzeImage = async (req, res) => {
  try {
    console.log('Image analysis request received');
    
    const { userId, imageData, prompt, context } = req.body;

    // Mock image analysis
    const analysis = {
      description: '明るく温かい雰囲気の室内の写真です。テーブルの上にコーヒーカップと本が置かれています。',
      objects: [
        { name: 'テーブル', confidence: 0.95, boundingBox: [100, 200, 300, 400] },
        { name: 'コーヒーカップ', confidence: 0.88, boundingBox: [150, 250, 200, 300] },
        { name: '本', confidence: 0.82, boundingBox: [220, 240, 280, 320] }
      ],
      colors: ['brown', 'white', 'beige'],
      mood: 'calm',
      style: 'natural'
    };

    // Generate response based on analysis and prompt
    let responseText = analysis.description;
    if (prompt) {
      responseText = `${prompt}についてお答えします。${analysis.description} 特に${analysis.objects[0]?.name}が印象的ですね。`;
    }

    const responseData = {
      analysis,
      response: {
        content: responseText,
        messageType: 'text',
        emotion: {
          dominant: 'analytical',
          confidence: 0.90
        }
      },
      metadata: {
        processingTime: Math.random() * 300 + 200,
        timestamp: new Date().toISOString(),
        imageSize: imageData?.length || 0,
        analysisModel: 'lumimei-vision-mock-v1'
      }
    };

    res.status(200).json({
      success: true,
      ...responseData
    });

  } catch (error) {
    console.error('Image analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Image analysis failed',
      message: error.message
    });
  }
};

// Get context - SIMPLIFIED VERSION
const getContext = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const mockContext = {
      userId,
      currentSession: 'session_' + Date.now(),
      mood: 'neutral',
      preferences: {
        language: 'ja',
        formality: 'polite'
      },
      recentTopics: ['天気', '予定', '音楽'],
      conversationHistory: [
        {
          messageId: 'msg_001',
          content: 'こんにちは',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          role: 'user'
        },
        {
          messageId: 'msg_002',
          content: 'こんにちは！お元気ですか？',
          timestamp: new Date(Date.now() - 280000).toISOString(),
          role: 'assistant'
        }
      ]
    };

    res.status(200).json({
      success: true,
      data: { context: mockContext }
    });

  } catch (error) {
    console.error('Context fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Context fetch failed'
    });
  }
};

// Update context - SIMPLIFIED VERSION
const updateContext = async (req, res) => {
  try {
    const { userId } = req.params;
    const contextUpdate = req.body;

    // Mock context update
    const updatedContext = {
      userId,
      ...contextUpdate,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      message: 'Context updated successfully',
      data: { context: updatedContext }
    });

  } catch (error) {
    console.error('Context update error:', error);
    res.status(500).json({
      success: false,
      error: 'Context update failed'
    });
  }
};

// Get session - SIMPLIFIED VERSION
const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const mockSession = {
      sessionId,
      userId: 'user_' + Date.now(),
      startTime: new Date(Date.now() - 600000).toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 5,
      status: 'active',
      context: {
        mood: 'friendly',
        topics: ['general']
      }
    };

    res.status(200).json({
      success: true,
      data: { session: mockSession }
    });

  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Session fetch failed'
    });
  }
};

// Execute device command - SIMPLIFIED VERSION
const executeDeviceCommand = async (req, res) => {
  try {
    const { deviceId, command, parameters } = req.body;

    // Mock command execution
    const execution = {
      commandId: 'cmd_' + Date.now(),
      deviceId,
      command,
      parameters,
      status: 'success',
      result: `Command "${command}" executed successfully on device ${deviceId}`,
      executedAt: new Date().toISOString(),
      responseTime: Math.random() * 100 + 20
    };

    res.status(200).json({
      success: true,
      message: 'Device command executed',
      data: { execution }
    });

  } catch (error) {
    console.error('Device command error:', error);
    res.status(500).json({
      success: false,
      error: 'Device command failed'
    });
  }
};

// Get voice output - MOCK IMPLEMENTATION
const getVoiceOutput = async (req, res) => {
  try {
    const { messageId } = req.params;

    const mockVoiceOutput = {
      messageId,
      audioData: 'mock_audio_base64_data',
      format: 'mp3',
      duration: 3.5,
      generatedAt: new Date().toISOString(),
      voice: {
        gender: 'neutral',
        language: 'ja-JP',
        speed: 1.0
      }
    };

    res.status(200).json({
      success: true,
      data: mockVoiceOutput
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Voice output generation failed'
    });
  }
};

// Start session - MOCK IMPLEMENTATION
const startSession = async (req, res) => {
  try {
    const { userId, sessionConfig } = req.body;

    const session = {
      sessionId: 'session_' + Date.now(),
      userId,
      config: sessionConfig || {},
      startTime: new Date().toISOString(),
      status: 'active'
    };

    res.status(201).json({
      success: true,
      message: 'Session started',
      data: { session }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Session start failed'
    });
  }
};

// End session - MOCK IMPLEMENTATION
const endSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    res.status(200).json({
      success: true,
      message: 'Session ended',
      data: {
        sessionId,
        endTime: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Session end failed'
    });
  }
};

// Get session status - MOCK IMPLEMENTATION
const getSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionStatus = {
      sessionId,
      status: 'active',
      startTime: new Date(Date.now() - 600000).toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 5
    };

    res.status(200).json({
      success: true,
      data: sessionStatus
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Session status fetch failed'
    });
  }
};

// Get command status - MOCK IMPLEMENTATION
const getCommandStatus = async (req, res) => {
  try {
    const { commandId } = req.params;

    const commandStatus = {
      commandId,
      status: 'completed',
      result: 'Command executed successfully',
      executedAt: new Date(Date.now() - 5000).toISOString(),
      responseTime: 85
    };

    res.status(200).json({
      success: true,
      data: commandStatus
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Command status fetch failed'
    });
  }
};

module.exports = {
  sendMessage,
  handleVoiceInput,
  analyzeImage,
  getContext,
  updateContext,
  getSession,
  executeDeviceCommand,
  getVoiceOutput,
  startSession,
  endSession,
  getSessionStatus,
  getCommandStatus
};
