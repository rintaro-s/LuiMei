/**
 * LumiMei OS Communication Controller - SIMPLIFIED MOCK VERSION
 * readme_app.md仕様に対応した通信API
 */

const { google } = require('googleapis');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

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
  let systemPrompt = process.env.LLM_SYSTEM_PROMPT || (
    `You are LumiMei assistant. Respond in Japanese when user input is Japanese. ` +
    `Always begin your entire response with a single line that starts with 'LLM-TAGS:' followed by semicolon-separated key=value pairs when relevant. ` +
    `Do NOT return JSON. After the LLM-TAGS line, include a human-readable explanation in natural language. ` +
    `Tags can include: calendar_api=true/false, calendar_action=list_events/create_event, date=YYYY-MM-DD, device_command=..., etc.`
  );

  // Incorporate desired tone into the system prompt if provided
  if (options && options.tone) {
    systemPrompt += `\nUser desired tone: ${options.tone}`;
  }

  // If calling the legacy client.py endpoint (default), use its expected payload shape
  const isClientPy = apiUrl.includes('127.0.0.1:8000') || apiUrl.includes('localhost');

  const clientPayload = {
    user_id: options.userId || context.userId || 'default_user',
    text: message,
    role_sheet: (() => {
      // role_sheet should be a dictionary/object for most LLM endpoints.
      // Accept provided object, or convert a simple tone into { tone: ... }.
      const provided = options.role_sheet || context.role_sheet || null;
      if (provided && typeof provided === 'object') return provided;
      if (provided && typeof provided === 'string' && provided.trim().length > 0) {
        // try to preserve string role_sheet if present
        return { content: provided };
      }
      if (options.tone) return { tone: options.tone };
      return null;
    })(),
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
  // Log the outgoing LLM call for debugging (truncate large payloads)
  try {
    const safePayload = JSON.stringify(payload);
    const truncated = safePayload.length > 1500 ? safePayload.slice(0, 1500) + '...[truncated]' : safePayload;
    console.log(`Calling LLM at ${apiUrl} with payload: ${truncated}`);
  } catch (logErr) {
    console.warn('Failed to stringify LLM payload for logging', logErr);
  }

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
  const raw = (text || '');
  const lines = raw.split('\n');
  const first = lines[0] || '';
  const result = { tags: {}, body: raw };

  // If first line contains LLM-TAGS:, parse and return remainder as body
  if (first.startsWith('LLM-TAGS:')) {
    const payload = first.replace('LLM-TAGS:', '').trim();
    const parts = payload.length ? payload.split(';').map(p => p.trim()).filter(Boolean) : [];
    parts.forEach(p => {
      const [k, v] = p.split('=').map(s => s.trim());
      if (k) result.tags[k] = v === undefined ? true : v;
    });
    // Preserve entire body after first line, trimmed of leading/trailing whitespace
    result.body = lines.slice(1).join('\n').trim();
  } else {
    // No tags: treat whole text as body unchanged
    result.body = raw.trim();
  }

  return result;
}

// ゲストユーザーの確保（存在しない場合は作成）
async function ensureGuestUser(userId) {
  try {
    let user = await User.findOne({ userId });
    
    if (!user) {
      user = new User({
        userId: userId,
        email: `${userId}@guest.local`,
        displayName: 'ゲストユーザー',
        isGuest: true,
        provider: 'guest'
      });
      await user.save();
      console.log('Guest user created:', userId);
    }
    
    return user;
  } catch (error) {
    console.error('Error ensuring guest user:', error);
    throw error;
  }
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

    // ゲストユーザーの確保
    await ensureGuestUser(userId);

    // Resolve user (req.user may be present from auth middleware)
    let user = req.user;
    if (!user) {
      try {
        user = await User.findOne({ userId: userId });
      } catch (e) { user = null; }
    }

    const messageId = generateMessageId();
    const sessionId = options.sessionId || 'session_' + Date.now();

    // ユーザーメッセージをデータベースに保存
    const userMessage = new ChatMessage({
      userId,
      sessionId,
      messageId: messageId + '_user',
      role: 'user',
      content: message,
      messageType,
      metadata: {
        context,
        processing: {
          receivedAt: new Date()
        }
      }
    });
    await userMessage.save();

    // Call LLM (mock or real integration)
    const startTime = Date.now();
    const llmRaw = await callLLM(message, context, options);
    const responseTime = Date.now() - startTime;
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
          console.error('Calendar API error:', e);
          assistantText += '\n\n(カレンダー取得中にエラーが発生しました)';
        }
      }
    }

    // アシスタントメッセージをデータベースに保存
    const assistantMessage = new ChatMessage({
      userId,
      sessionId,
      messageId: messageId + '_assistant',
      role: 'assistant',
      content: assistantText,
      messageType: 'text',
      metadata: {
        context,
        processing: {
          responseTime,
          model: 'mock-llm',
          llmTags: parsed.tags
        }
      }
    });
    await assistantMessage.save();

    // ユーザーの使用量更新
    if (user && typeof user.incrementUsage === 'function') {
      await user.incrementUsage('message', 1);
    } else if (user) {
      // Fallback for guest users - update directly
      await User.findByIdAndUpdate(user._id, {
        $inc: {
          'usage.totalMessages': 1,
          'usage.monthlyUsage.messages': 1
        },
        $set: {
          'usage.lastActivityDate': new Date()
        }
      });
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
        processingTime: responseTime,
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
  // Do NOT default to a local HTTP STT that isn't configured.
  const configuredSttUrl = process.env.STT_API_URL || null;

  // First try local VOSK via Python helper
  try {
    const local = await performLocalSTT(audioData, format, options);
    if (local && local.text) return local;
  } catch (e) {
    console.warn('Local STT helper failed or unavailable:', e.message || e);
  }

  // Next, if an external STT API is configured, call it
  if (configuredSttUrl) {
    try {
      const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData, 'base64');
      const { FormData } = await import('formdata-node');
      const { Blob } = await import('node:buffer');

      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: `audio/${format || 'wav'}` });
      formData.append('audio', audioBlob, `audio.${format || 'wav'}`);
      formData.append('language', options.language || 'ja');

      const headers = {};
      if (process.env.STT_API_KEY) headers['Authorization'] = `Bearer ${process.env.STT_API_KEY}`;

      const response = await fetch(configuredSttUrl, { method: 'POST', headers, body: formData });
      if (!response.ok) throw new Error(`STT API error: ${response.status} ${response.statusText}`);
      const result = await response.json();
      return { text: result.text || result.transcript || result.result || '', confidence: result.confidence || result.score || 0.8 };
    } catch (err) {
      console.warn('External STT API failed:', err.message || err);
    }
  }

  // Finally, if OPENAI key is set, call OpenAI Audio Transcription (whisper-1)
  if (process.env.OPENAI_API_KEY) {
    try {
      const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData, 'base64');
      const { FormData, fileFromPath } = await import('formdata-node');
      const { Blob } = await import('node:buffer');
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: `audio/${format || 'wav'}` });
      formData.append('file', audioBlob, `audio.${format || 'wav'}`);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: formData
      });
      if (!response.ok) throw new Error(`OpenAI STT error: ${response.status} ${response.statusText}`);
      const j = await response.json();
      return { text: j.text || j.transcription || '', confidence: j.confidence || 0.85 };
    } catch (openErr) {
      console.warn('OpenAI STT failed:', openErr.message || openErr);
    }
  }

  throw new Error('No available STT method succeeded. Configure VOSK model, STT_API_URL, or OPENAI_API_KEY.');
}

// Local STT fallback (simplified - returns mock transcription)
async function performLocalSTT(audioData, format, options = {}) {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const child_process = require('child_process');

    console.log('Attempting local STT using Python VOSK helper');

    const modelPath = process.env.VOSK_MODEL_PATH || path.resolve(process.cwd(), 'vosk-model-ja-0.22');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meimi-stt-'));
    const wavPath = path.join(tempDir, `input.wav`);

    // Ensure audioBuffer is PCM16 WAV. If raw, try to write as WAV header + data.
    let audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData, 'base64');

    // If input doesn't have WAV header, wrap it as WAV PCM16
    if (audioBuffer.length < 44 || !audioBuffer.slice(0, 4).equals(Buffer.from('RIFF'))) {
      // Create WAV header for PCM16, 16kHz mono
      const sampleRate = options.sampleRate || 16000;
      const channels = 1;
      const bitsPerSample = 16;
      const dataSize = audioBuffer.length;
      const fileSize = 36 + dataSize;
      
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);                          // ChunkID
      header.writeUInt32LE(fileSize, 4);                // ChunkSize
      header.write('WAVE', 8);                          // Format
      header.write('fmt ', 12);                         // Subchunk1ID
      header.writeUInt32LE(16, 16);                     // Subchunk1Size
      header.writeUInt16LE(1, 20);                      // AudioFormat (PCM)
      header.writeUInt16LE(channels, 22);               // NumChannels
      header.writeUInt32LE(sampleRate, 24);             // SampleRate
      header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // ByteRate
      header.writeUInt16LE(channels * bitsPerSample / 8, 32); // BlockAlign
      header.writeUInt16LE(bitsPerSample, 34);          // BitsPerSample
      header.write('data', 36);                         // Subchunk2ID
      header.writeUInt32LE(dataSize, 40);               // Subchunk2Size
      
      audioBuffer = Buffer.concat([header, audioBuffer]);
    }

    fs.writeFileSync(wavPath, audioBuffer);

    if (fs.existsSync(modelPath)) {
      // Call python helper
      try {
        const py = process.env.PYTHON_BIN || 'python';
        const script = path.resolve(process.cwd(), 'backend', 'tools', 'vosk_stt.py');
        const args = [script, wavPath, modelPath, String(options.sampleRate || 16000)];
        const out = child_process.execFileSync(py, args, { 
          encoding: 'utf8', 
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
        const parsed = JSON.parse(out);
        if (parsed.error) {
          console.error('Python VOSK failed:', parsed);
        } else {
          // cleanup
          try { fs.unlinkSync(wavPath); fs.rmdirSync(tempDir, { recursive: true }); } catch(_){}
          return { text: parsed.text || '', confidence: parsed.confidence || 0.85 };
        }
      } catch (pyErr) {
        console.error('Calling python VOSK helper failed:', pyErr.message || pyErr.toString());
      }
    }

    // Fallback to a more robust external STT service or whisper if available
    console.log('VOSK model not found or python helper failed, falling back to external STT if configured');
    throw new Error('Local VOSK unavailable');

  } catch (e) {
    console.error('Local STT failed:', e.message || e);
    return { text: '', confidence: 0.0 };
  }
}

// Analyze image - SIMPLIFIED VERSION
const analyzeImage = async (req, res) => {
  try {
    console.log('Image analysis request received');
    
    const { userId, imageData, prompt, context } = req.body;

    // If LM Studio (or OpenAI-compatible) endpoint is configured, call it
    const lmstudioUrl = process.env.LMSTUDIO_API_URL; // e.g., http://127.0.0.1:1234/v1/chat/completions
    const lmstudioModel = process.env.LMSTUDIO_MODEL || 'gemma-3-12b-it@q4_k_m';

    let analysis = null;
    let responseText = '';

    if (lmstudioUrl) {
      try {
        const systemPrompt = (process.env.VISION_SYSTEM_PROMPT || 
          `あなたは優秀な問題解決アシスタントです。画像を見て、この問題を解いてください。
           
           与えられた画像の内容を分析し、以下を含む詳細な解説を日本語で提供してください：
           1. 画像に含まれる主要な要素や情報
           2. 数式、図表、文字などの重要な内容の解読
           3. 問題の解き方や手順の説明
           4. 最終的な答えや結論
           5. 関連する概念や知識の補足説明
           
           回答は丁寧で分かりやすく、構造化された形式で提供してください。`
        ).trim();
        
        const userPrompt = (prompt && prompt.length > 0)
          ? `【問題分析要求】: ${prompt}\n\n画像内の問題を解いて、詳細な解説とともに答えを教えてください。`
          : `画像内にある問題や課題を特定し、それを解いて詳細な解説とともに答えを教えてください。もし問題が明確でない場合は、画像の内容を分析して重要な情報を抽出してください。`;

        // For vision models, include the image in the message
        const messages = [
          { role: 'system', content: systemPrompt }
        ];
        
        // If image data is provided, add it to user message (for vision-capable models)
        if (imageData && imageData.length > 0) {
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:image/jpeg;base64,${imageData}` 
                } 
              }
            ]
          });
        } else {
          messages.push({ role: 'user', content: userPrompt });
        }
        const payload = {
          model: lmstudioModel,
          messages: messages,
          temperature: 0.3,
          max_tokens: 2000
        };

        // Create AbortController for timeout handling
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 120000); // 2 minutes timeout

        const resp = await fetch(lmstudioUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortController.signal
        });
        
        clearTimeout(timeoutId);

        if (!resp.ok) {
          throw new Error(`LM Studio error: ${resp.status} ${resp.statusText}`);
        }

        const data = await resp.json();
        responseText = data.choices?.[0]?.message?.content || '';
        analysis = {
          description: responseText,
          objects: [],
          colors: [],
          mood: 'analytical',
          style: 'problem-solving',
          extractedText: ''
        };
      } catch (e) {
        console.error('LM Studio vision call failed, falling back to mock:', e.message);
      }
    }

    // Mock image analysis as fallback or when LM Studio is not configured
    if (!analysis) analysis = {
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
    if (!responseText) responseText = analysis.description;
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
  analysisModel: lmstudioUrl ? `lmstudio:${lmstudioModel}` : 'lumimei-vision-mock-v1'
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

// Export callLLM for programmatic use by other controllers
module.exports.callLLM = callLLM;
