const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.resolve(__dirname, '..', '..', 'logs');
const ERROR_LOG_PATH = process.env.ERROR_LOG_PATH || path.join(LOG_DIR, 'error.log');

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) { /* ignore */ }
}

function writeErrorLog(entry) {
  try {
    ensureLogDir();
    const payload = Object.assign({ ts: new Date().toISOString() }, entry);
    fs.appendFileSync(ERROR_LOG_PATH, JSON.stringify(payload) + '\n');
  } catch (e) {
    // best-effort only
    console.error('[error-logger] failed to write error log', e && e.message ? e.message : e);
  }
}

module.exports = {
  writeErrorLog,
  ERROR_LOG_PATH
};
