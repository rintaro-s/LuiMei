/**
 * Status Controller
 */

const getStatus = async (req, res) => {
  const status = {
    models: { llm: 'ok', tts: 'ok', stt: 'syncing' },
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };
  res.json(status);
};

module.exports = { getStatus };
