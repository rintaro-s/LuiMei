const fs = require('fs');
const path = require('path');

const LOG_PATH = process.env.REQUEST_LOG_PATH || path.join(__dirname, '..', '..', 'logs', 'requests.log');

function ensureDir() {
  try {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) { /* ignore */ }
}

function maskAuth(header) {
  if (!header) return null;
  try {
    const h = header.toString();
    if (h.startsWith('Bearer ')) {
      const t = h.slice(7).trim();
      if (t.length <= 12) return 'Bearer ' + t;
      return 'Bearer ' + t.slice(0, 6) + '...' + t.slice(-6);
    }
    if (h.length <= 12) return h;
    return h.slice(0, 6) + '...' + h.slice(-6);
  } catch (e) { return null; }
}

function write(entry) {
  try {
    ensureDir();
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
  } catch (e) { console.error('[request-logger] write error', e && e.message ? e.message : e); }
}

function requestLogger(req, res, next) {
  try {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const body = req.body;
      // Avoid logging extremely large bodies
      let shortBody;
      try {
        const str = JSON.stringify(body);
        shortBody = str.length > 4000 ? str.slice(0, 4000) + '...<truncated>' : str;
      } catch (e) {
        shortBody = String(body);
      }

      const entry = {
        ts: new Date().toISOString(),
        remote: req.ip || req.connection && req.connection.remoteAddress || '-',
        method: req.method,
        path: req.originalUrl || req.url,
        headers: {
          authorization: maskAuth(req.headers && req.headers.authorization),
          'content-type': req.headers && req.headers['content-type']
        },
        body: shortBody
      };
      write(entry);
    }
  } catch (e) { /* ignore logging errors */ }
  return next();
}

module.exports = requestLogger;
