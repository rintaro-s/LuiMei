/**
 * Assistant Extended Controller
 * Implements session start, tools list, TTS direct endpoint, wakeword suggestions,
 * history storage/query, STT async job endpoints, and streaming event helpers (mock).
 */

// Simple in-memory stores for mocks
const sessions = new Map();
const histories = [];
const sttJobs = new Map();

function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// POST /api/assistant/session
const startSession = async (req, res) => {
  const { userId, locale = 'ja-JP', model = 'gpt-mock', options = {} } = req.body || {};
  if (!userId) return res.status(400).json({ error: true, message: 'userId required' });

  const sessionId = generateId('sess');
  const expiresAt = new Date(Date.now() + (options.ttlMs || 1000 * 60 * 30)).toISOString();

  sessions.set(sessionId, { userId, locale, model, options, expiresAt });

  res.json({ sessionId, expiresAt });
};

// GET /api/assistant/tools
const listTools = async (req, res) => {
  // Mock tool definitions
  const tools = [
    { name: 'smart_home', description: 'Control smart home devices', paramsSchema: { type: 'object', properties: { deviceId: { type: 'string' }, command: { type: 'string' } }, required: ['deviceId','command'] } },
    { name: 'calendar', description: 'Query user calendar', paramsSchema: { type: 'object', properties: { date: { type: 'string' } } } }
  ];

  res.json(tools);
};

// GET /api/tts?voice=meimei&text=...
const getTTS = async (req, res) => {
  const text = req.query.text || req.body?.text || '';
  const voice = req.query.voice || 'meimei';
  const format = req.query.format || 'pcm';

  if (!text) return res.status(400).json({ error: true, message: 'text query required' });

  // Return mock audio buffer
  const audioBuf = Buffer.from(`tts_audio_${voice}_${text}`);
  const contentType = format === 'opus' ? 'audio/opus' : 'audio/pcm';

  res.set('Content-Type', contentType);
  res.send(audioBuf);
};

// POST /api/assistant/wakeword/suggest
const suggestWakewords = async (req, res) => {
  const { locale = 'ja-JP', seedName = 'メイ' } = req.body || {};
  const suggestions = [
    `ヘイ ${seedName}`,
    `オー ${seedName}`,
    `${seedName}ちゃん`
  ];
  res.json({ suggestions });
};

// GET /api/assistant/history?userId=&limit=50
const queryHistory = async (req, res) => {
  const { userId, limit = 50 } = req.query;
  const results = histories.filter(h => !userId || h.userId === userId).slice(-limit);
  res.json({ results });
};

// POST /api/assistant/history { sessionId, transcript, latencyMs }
const storeHistory = async (req, res) => {
  const { sessionId, transcript, latencyMs, userId } = req.body || {};
  if (!sessionId || !transcript) return res.status(400).json({ error: true, message: 'sessionId and transcript required' });
  const id = generateId('hist');
  const item = { id, sessionId, userId, transcript, latencyMs, timestamp: new Date().toISOString() };
  histories.push(item);
  res.json({ success: true, id });
};

// POST /api/stt/async -> { jobId }
const createSttJob = async (req, res) => {
  const { userId } = req.body || {};
  const jobId = generateId('stt');
  sttJobs.set(jobId, { status: 'queued', userId, createdAt: new Date().toISOString() });
  // simulate completion after short delay (non-blocking)
  setTimeout(() => {
    sttJobs.set(jobId, { status: 'done', result: 'これは非同期の文字起こし結果です', completedAt: new Date().toISOString(), userId });
  }, 3000);
  res.json({ jobId });
};

// GET /api/stt/async/:jobId
const getSttJob = async (req, res) => {
  const { jobId } = req.params;
  if (!sttJobs.has(jobId)) return res.status(404).json({ error: true, message: 'job not found' });
  res.json(sttJobs.get(jobId));
};

module.exports = {
  startSession,
  listTools,
  getTTS,
  suggestWakewords,
  queryHistory,
  storeHistory,
  createSttJob,
  getSttJob
};
