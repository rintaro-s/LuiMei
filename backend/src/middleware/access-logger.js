/**
 * Access logger middleware
 * Logs incoming requests (method, path, ip, headers summary, truncated body)
 */
const fs = require('fs');
const path = require('path');

const LOG_PATH = process.env.ACCESS_LOG_PATH || path.join(__dirname, '..', '..', 'logs', 'access.log');

function ensureLogDir() {
  try {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function maskToken(auth) {
  if (!auth) return null;
  try {
    if (auth.startsWith('Bearer ')) {
      const t = auth.slice(7).trim();
      if (t.length <= 12) return 'Bearer ' + t;
      return 'Bearer ' + t.slice(0, 8) + '...' + t.slice(-8);
    }
    if (auth.length <= 12) return auth;
    return auth.slice(0, 8) + '...' + auth.slice(-8);
  } catch (e) { return auth; }
}

function formatHeaders(headers) {
  const out = {};
  // include only useful headers and mask Authorization
  ['host','user-agent','content-type','accept','authorization','x-forwarded-for'].forEach(h => {
    if (headers[h]) out[h] = h === 'authorization' ? maskToken(headers[h]) : headers[h];
  });
  return out;
}

module.exports = function accessLogger(options = {}) {
  ensureLogDir();
  return (req, res, next) => {
    const start = Date.now();
    const remote = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || '-';
    const smallBody = (req.body && Object.keys(req.body).length) ? JSON.stringify(req.body).slice(0, 200) : '';

    const entry = {
      ts: new Date().toISOString(),
      remote,
      method: req.method,
      path: req.originalUrl || req.url,
      headers: formatHeaders(req.headers || {}),
      body: smallBody
    };

    // after response finished, append status and timing
    res.on('finish', () => {
      entry.status = res.statusCode;
      entry.durationMs = Date.now() - start;
      const line = JSON.stringify(entry);
      try {
        fs.appendFileSync(LOG_PATH, line + '\n');
      } catch (e) {
        console.log('[access-logger] write error', e.message);
      }
      // Also print to console for quick debugging
      console.log('[access]', entry.method, entry.path, entry.status, `${entry.durationMs}ms`, remote, entry.headers.authorization || '');
    });

    next();
  };
};
