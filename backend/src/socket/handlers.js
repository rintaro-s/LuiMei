/**
 * LumiMei OS Socket.IO Event Handlers
 * シンプルで整った単一実装（重複と構文エラーを排除）
 */

// Helper: generate mock TTS audio chunks (base64) from text
function generateStreamingTTS(text, options = {}) {
  const chunkSize = 12;
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    const base64 = Buffer.from(`mock_audio:${chunk}:${options.voice || 'meimei'}`).toString('base64');
    chunks.push({ seq: Math.floor(i / chunkSize) + 1, text: chunk, base64, isLast: i + chunkSize >= text.length });
  }
  return chunks;
}

// Helper: simple rule-based response generator for demo
function generateStreamingResponse(userText, context = {}) {
  if (!userText || typeof userText !== 'string') return 'ご質問ありがとうございます。詳しくお答えします。';
  if (userText.match(/予定|カレンダー|calendar/)) return '今日の予定は、午後3時に面談が入っています。';
  if (userText.match(/天気|weather/)) return '今日は晴れで、最高気温は25度の予想です。お出かけ日和ですね！';
  if (userText.match(/音楽|music/)) return 'お気に入りの音楽を再生しますね。リラックスできる曲をかけます。';
  return 'ご質問ありがとうございます。詳しくお答えします。';
}

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('join_user_room', (data) => {
      const { userId } = data || {};
      if (userId) {
        const room = `user_${userId}`;
        socket.join(room);
        socket.emit('room_joined', { success: true, userId, roomId: room, timestamp: new Date().toISOString() });
      }
    });

    const handleStreamStart = async (data) => {
      try {
        const { userId, sessionId, userText, options = {} } = data || {};
        if (!userId || !userText) {
          socket.emit('stream_error', { success: false, error: { code: 'MISSING_FIELDS', message: 'userId and userText are required' } });
          return;
        }

        const session = sessionId || `stream_${Date.now()}`;
        const fullResponse = generateStreamingResponse(userText, data.context);
        const audioChunks = generateStreamingTTS(fullResponse, options);

        socket.emit('stream_started', { success: true, sessionId: session, expectedChunks: audioChunks.length, timestamp: new Date().toISOString() });

        let accumulated = '';
        for (let i = 0; i < audioChunks.length; i++) {
          const c = audioChunks[i];
          accumulated += c.text;
          socket.emit('partial_text', { type: 'partial_text', text: accumulated, progress: (i + 1) / audioChunks.length, sessionId: session });
          socket.emit('audio_chunk', { type: 'audio_chunk', seq: c.seq, base64: c.base64, format: options.format || 'wav', sampleRate: options.sampleRate || 24000, isLast: c.isLast, sessionId: session });
          // small delay to simulate streaming
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 80));
        }

        // Optionally simulate a function/tool call
        if (userText && /予定|カレンダー|calendar/i.test(userText)) {
          const callId = `call_${Date.now()}`;
          socket.emit('function_call', { name: 'calendar', callId, args: { date: new Date().toISOString().slice(0, 10) }, sessionId: session });
          // simulate tool processing
          await new Promise((r) => setTimeout(r, 180));
          socket.emit('function_result', { callId, result: { events: [{ title: '面談', time: '15:00' }] }, sessionId: session });
        }

        socket.emit('final_text', { type: 'final_text', text: fullResponse, totalChunks: audioChunks.length, sessionId: session });
        socket.emit('stream_end', { type: 'end', success: true, sessionId: session, totalTime: audioChunks.length * 100, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('Stream error', err);
        socket.emit('stream_error', { success: false, error: { code: 'STREAM_ERROR', message: 'Failed to process streaming request' } });
      }
    };

    // register both legacy and recommended event names
    socket.on('stream_start', handleStreamStart);
    socket.on('start', handleStreamStart);

    socket.on('user_text', (d) => {
      if (d?.text) socket.emit('partial_text', { type: 'partial_text', text: d.text, progress: 0.5, sessionId: d?.sessionId });
    });

    socket.on('user_audio_chunk', (d) => {
      // echo ack for received audio chunk
      socket.emit('audio_chunk_ack', { seq: d?.seq, sessionId: d?.sessionId });
    });

    socket.on('end', (d) => {
      socket.emit('stream_end', { type: 'end', success: true, sessionId: d?.sessionId });
    });

    socket.on('device_status_update', (d) => {
      const { userId, deviceId, status } = d || {};
      if (userId) socket.to(`user_${userId}`).emit('device_status_changed', { deviceId, status, timestamp: new Date().toISOString() });
    });

    socket.on('chat_message', async (data) => {
      const { userId, message, context = {} } = data || {};
      if (!userId || !message) return socket.emit('chat_error', { success: false, error: 'userId and message are required' });
      const response = generateStreamingResponse(message, context);
      socket.emit('ai_response', { success: true, response: { content: response, type: 'text' }, messageId: `msg_${Date.now()}`, timestamp: new Date().toISOString() });
      socket.to(`user_${userId}`).emit('user_activity', { userId, activity: 'chat_message', timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
    socket.on('error', (e) => console.error('Socket error', e));
  });

  // heartbeat for clients
  setInterval(() => { io.emit('heartbeat', { timestamp: new Date().toISOString(), activeConnections: io.engine ? io.engine.clientsCount : 0 }); }, 30000);
};

module.exports = { setupSocketHandlers };
