/**
 * 外部API呼び出し用ヘルパー関数
 * 共通のエラーハンドリングとリトライ機能を提供
 */

const axios = require('axios');
const Logger = require('./logger');

class ExternalAPIHelper {
  static async makeRequest(config, retries = 3) {
    const defaultConfig = {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Meimi-Assistant/1.0'
      }
    };

    const requestConfig = { ...defaultConfig, ...config };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        Logger.debug(`API Request attempt ${attempt}/${retries}`, {
          url: requestConfig.url,
          method: requestConfig.method || 'GET'
        });

        const response = await axios(requestConfig);
        Logger.debug('API Request successful', {
          status: response.status,
          url: requestConfig.url
        });

        return response.data;
      } catch (error) {
        Logger.warn(`API Request failed (attempt ${attempt}/${retries})`, {
          url: requestConfig.url,
          error: error.message,
          status: error.response?.status
        });

        if (attempt === retries) {
          Logger.error('API Request failed after all retries', {
            url: requestConfig.url,
            error: error.message
          });
          throw error;
        }

        // 指数バックオフで待機
        const delay = Math.pow(2, attempt) * 1000;
        await this.sleep(delay);
      }
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static createFormData(data) {
    const FormData = require('form-data');
    const formData = new FormData();
    
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Buffer || value instanceof require('stream').Readable) {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    }
    
    return formData;
  }

  static parseErrorResponse(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.message || error.response.statusText,
        details: error.response.data
      };
    } else if (error.request) {
      return {
        status: 0,
        message: 'ネットワークエラー: サーバーに接続できません',
        details: null
      };
    } else {
      return {
        status: -1,
        message: error.message,
        details: null
      };
    }
  }
}

module.exports = ExternalAPIHelper;
