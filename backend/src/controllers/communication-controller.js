/**
 * LumiMei OS Communication Controller - SIMPLIFIED MOCK VERSION
 * readme_app.md仕様に対応した通信API
 */

const { google } = require('googleapis');

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

// call LLM server (expects plain text response containing first-line tags)
async function callLLM(message, context = {}, options = {}) {
  // Default to client.py local server if no LLM_API_URL specified
  const defaultClientUrl = 'http://127.0.0.1:8000/chat';
  const apiUrl = process.env.LLM_API_URL || defaultClientUrl;

  // Construct system prompt
  const systemPrompt = process.env.LLM_SYSTEM_PROMPT || (
    `You are LumiMei assistant. Respond in Japanese when user input is Japanese. ` +
    `Always begin your entire response with a single line that starts with 'LLM-TAGS:' followed by semicolon-separated key=value pairs when relevant. ` +
    `Do NOT return JSON. After the LLM-TAGS line, include a human-readable explanation in natural language. ` +
    `Tags can include: calendar_api=true/false, calendar_action=list_events/create_event, date=YYYY-MM-DD, device_command=..., etc.`
  );

  // If calling the legacy client.py endpoint (default), use its expected payload shape
  const isClientPy = apiUrl.includes('127.0.0.1:8000') || apiUrl.includes('localhost');

  const clientPayload = {
    user_id: options.userId || context.userId || 'default_user',
    text: message,
    role_sheet: options.role_sheet || context.role_sheet || null,
    over_hallucination: options.over_hallucination || false,
    history: options.history || context.history || [],
    compressed_memory: options.compressed_memory || context.compressed_memory || null
  };

  const payload = isClientPy ? clientPayload : {
    system: systemPrompt,
    input: message,
    context: context,
    options: options
  };

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.LLM_API_KEY) headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`;

  // Use global fetch (Node 18+)
  const resp = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`LLM server error: ${resp.status} ${resp.statusText} - ${txt}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const j = await resp.json();
    // If replying to client.py, try to extract the 'response' field
    if (isClientPy) {
      const respField = j.response || j.get?.('response') || j["response"];
      if (typeof respField === 'string') return respField;
      if (respField && typeof respField === 'object') {
        // common shape: { content: 'text', ... }
        return respField.content || JSON.stringify(respField);
      }
    }
    // Generic extraction
    return j.text || j.output || j.result || JSON.stringify(j);
  }

  // Plain text fallback
  const text = await resp.text();
  return text;
}

function parseLlmTags(text) {
  const lines = (text || '').split('\n');
  const first = lines[0] || '';
  const result = { tags: {}, body: lines.slice(1).join('\n') };
  if (first.startsWith('LLM-TAGS:')) {
    const payload = first.replace('LLM-TAGS:', '').trim();
    if (payload.length === 0) return result;
    const parts = payload.split(';').map(p => p.trim()).filter(Boolean);
    parts.forEach(p => {
      const [k, v] = p.split('=').map(s => s.trim());
      if (k) result.tags[k] = v === undefined ? true : v;
    });
  }
  return result;
}

// Send message endpoint - CLIENT COMPATIBLE VERSION (LLM tag protocol)
const sendMessage = async (req, res) => {
  try {
    console.log('Message request received:', JSON.stringify(req.body, null, 2));
    const { userId, messageType = 'text', message, context = {}, options = {} } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [
          { field: 'userId', message: 'userId is required' },
          { field: 'message', message: 'message is required' }
        ]
      });
    }

    // Resolve user (req.user may be present from auth middleware)
    let user = req.user;
    if (!user) {
      try {
        const User = require('../models/User');
        user = await User.findOne({ userId: userId });
      } catch (e) { user = null; }
    }

    const messageId = generateMessageId();
    const sessionId = options.sessionId || 'session_' + Date.now();

    // Call LLM (mock or real integration)
    const llmRaw = await callLLM(message, context, options);
    const parsed = parseLlmTags(llmRaw);

    // Default response body from LLM
    let assistantText = parsed.body || '';
    let extra = {};

    // If LLM asked for calendar access, perform calendar API call server-side
    if (parsed.tags['calendar_api'] && parsed.tags['calendar_api'].toString() === 'true') {
      // require google access
      if (!user || !user.isGoogleUser || !user.isGoogleUser()) {
        assistantText += '\n\n(カレンダー連携が必要です。Googleアカウントを連携してください。)';
      } else if (!user.hasPermission || !user.hasPermission('calendar.read')) {
        assistantText += '\n\n(カレンダー閲覧の許可がありません。権限を付与してください。)';
      } else {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GCP_OAUTH2_CLIENT_ID,
            process.env.GCP_OAUTH2_CLIENT_SECRET,
            process.env.GCP_OAUTH2_REDIRECT_URI
          );
          oauth2Client.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken
          });

          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
          const date = parsed.tags['date'] || new Date().toISOString().split('T')[0];
          const timeMin = new Date(date + 'T00:00:00').toISOString();
          const timeMax = new Date(date + 'T23:59:59').toISOString();
          const calRes = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime'
          });

          const items = calRes.data.items || [];
          extra.calendar = { date, total: items.length, events: items.map(ev => ({
            id: ev.id,
            summary: ev.summary,
            start: ev.start,
            end: ev.end,
            attendees: ev.attendees || []
          })) };

          assistantText += `\n\n(取得した予定: ${items.length} 件)`;
        } catch (e) {
          console.error('Calendar fetch error:', e.message);
          assistantText += '\n\n(カレンダーの取得に失敗しました)';
        }
      }
    }

    // Prepare response
    const responseData = {
      success: true,
      messageId,
      sessionId,
      response: {
        content: assistantText,
        type: 'text',
        llm_raw: llmRaw // for debugging; may remove in production
      },
      metadata: {
        timestamp: new Date().toISOString(),
        messageType,
        userId,
        processingTime: Math.floor(Math.random() * 200) + 50,
        parsedTags: parsed.tags,
        ...extra
      }
    };

    console.log('Message processed successfully for user:', userId, 'tags=', parsed.tags);
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Message processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Message processing failed',
      details: [{ field: 'server', message: error.message }]
    });
  }
};

// Handle voice input - FULL IMPLEMENTATION
const handleVoiceInput = async (req, res) => {
  try {
    console.log('Voice input request received');
    
    const { userId, audioData, format, options = {} } = req.body;

    if (!userId || !audioData) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [
          { field: 'userId', message: 'userId is required' },
          { field: 'audioData', message: 'audioData is required' }
        ]
      });
    }

    // Real speech-to-text implementation
    let transcription = '';
    let confidence = 0;

    try {
      // Use external STT service or local processing
      const sttResponse = await performSpeechToText(audioData, format, options);
      transcription = sttResponse.text || '';
      confidence = sttResponse.confidence || 0;
    } catch (sttError) {
      console.error('STT processing error:', sttError);
      // Fallback to mock for development
      transcription = 'STT処理中にエラーが発生しました。音声が明確に聞こえませんでした。';
      confidence = 0.1;
    }

    // If transcription successful, process as text message
    let response = { content: '音声を認識できませんでした', messageType: 'text' };
    
    if (transcription && confidence > 0.3) {
      try {
        // Call LLM with transcribed text
        const llmResponse = await callLLM(transcription, { userId }, options);
        const parsed = parseLlmTags(llmResponse);
        response = {
          content: parsed.body || '申し訳ございません、応答を生成できませんでした',
          messageType: 'text',
          llm_raw: llmResponse
        };
      } catch (llmError) {
        console.error('LLM processing error:', llmError);
        response.content = generateMockResponse(transcription);
      }
    }

    const responseData = {
      transcription,
      confidence,
      response: {
        ...response,
        emotion: {
          dominant: confidence > 0.7 ? 'confident' : 'uncertain',
          confidence: Math.min(confidence + 0.1, 1.0)
        }
      },
      metadata: {
        processingTime: Math.random() * 300 + 150,
        timestamp: new Date().toISOString(),
        audioFormat: format || 'wav',
        language: options?.language || 'ja-JP',
        sttEngine: process.env.STT_ENGINE || 'whisper-local'
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

// Speech-to-Text implementation
async function performSpeechToText(audioData, format, options = {}) {
  const sttUrl = process.env.STT_API_URL || 'http://127.0.0.1:9000/asr';
  
  try {
    // Convert base64 to buffer if needed
    const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData, 'base64');
    
    // Prepare request body based on STT service
    const formData = new FormData();
    formData.append('audio', audioBuffer, { filename: `audio.${format || 'wav'}` });
    formData.append('language', options.language || 'ja');
    
    const headers = { 'Content-Type': 'multipart/form-data' };
    if (process.env.STT_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.STT_API_KEY}`;
    }

    const response = await fetch(sttUrl, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      throw new Error(`STT API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      text: result.text || result.transcript || result.result || '',
      confidence: result.confidence || result.score || 0.8
    };

  } catch (error) {
    console.error('STT API call failed:', error);
    
    // Fallback: Use local Whisper or alternative
    try {
      return await performLocalSTT(audioData, format, options);
    } catch (localError) {
      console.error('Local STT also failed:', localError);
      throw new Error('All STT methods failed');
    }
  }
}

// Local STT fallback (simplified)
async function performLocalSTT(audioData, format, options = {}) {
  // This would integrate with local Whisper, DeepSpeech, or similar
  // For now, return mock data to maintain functionality
  return {
    text: '音声認識のローカル処理が実装されていません',
    confidence: 0.1
  };
}

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
