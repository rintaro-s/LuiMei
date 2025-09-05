/**
 * ログユーティリティ
 * アプリケーション全体で使用する統一されたログ機能を提供
 */

class Logger {
  static log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level.toLowerCase()) {
      case 'error':
        console.error(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(formattedMessage, ...args);
        }
        break;
      default:
        console.log(formattedMessage, ...args);
    }
  }

  static error(message, ...args) {
    this.log('error', message, ...args);
  }

  static warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  static info(message, ...args) {
    this.log('info', message, ...args);
  }

  static debug(message, ...args) {
    this.log('debug', message, ...args);
  }
}

module.exports = Logger;
