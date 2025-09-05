/**
 * LumiMei OS TTS (Text-to-Speech) Controller
 * 音声合成機能の実装
 */

const ExternalAPIHelper = require('../../utils/external-api');
const logger = require('../../utils/logger');

/**
 * TTS音声合成コントローラー
 */
class TTSController {
  
  /**
   * テキストを音声に変換
   */
  async synthesizeSpeech(req, res) {
    try {
      const { text, voice, format = 'wav', speed = 1.0, pitch = 1.0 } = req.body;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'TextRequired',
          message: 'Text is required for speech synthesis'
        });
      }

      // 音声合成処理
      const audioResult = await this.performTTS(text, voice, { format, speed, pitch });
      
      if (audioResult.stream) {
        // ストリーミング応答
        res.setHeader('Content-Type', `audio/${format}`);
        res.setHeader('Transfer-Encoding', 'chunked');
        audioResult.stream.pipe(res);
      } else {
        // 一括応答
        res.json({
          success: true,
          audioData: audioResult.base64,
          format: audioResult.format,
          duration: audioResult.duration,
          voice: audioResult.voice,
          metadata: {
            textLength: text.length,
            processingTime: audioResult.processingTime,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.error('TTS synthesis failed:', error);
      res.status(500).json({
        success: false,
        error: 'TTSError',
        message: 'Failed to synthesize speech'
      });
    }
  }

  /**
   * 利用可能な音声一覧
   */
  async getAvailableVoices(req, res) {
    try {
      const voices = await this.getVoiceList();
      
      res.json({
        success: true,
        voices,
        count: voices.length
      });
    } catch (error) {
      logger.error('Failed to get voice list:', error);
      res.status(500).json({
        success: false,
        error: 'VoiceListError',
        message: 'Failed to retrieve voice list'
      });
    }
  }

  /**
   * ストリーミング音声合成
   */
  async streamSpeech(req, res) {
    try {
      const { text, voice, format = 'wav' } = req.body;
      const userId = req.user?.userId;
      
      if (!text || !userId) {
        return res.status(400).json({
          success: false,
          error: 'MissingParameters',
          message: 'Text and userId are required'
        });
      }

      // WebSocket経由でストリーミング
      const io = req.app.get('io');
      if (!io) {
        return res.status(500).json({
          success: false,
          error: 'WebSocketUnavailable',
          message: 'WebSocket connection not available'
        });
      }

      // TTS処理を開始
      const jobId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // バックグラウンドでTTS処理
      this.performStreamingTTS(text, voice, format, userId, jobId, io);
      
      res.json({
        success: true,
        jobId,
        message: 'TTS streaming started'
      });
    } catch (error) {
      logger.error('TTS streaming failed:', error);
      res.status(500).json({
        success: false,
        error: 'TTSStreamError',
        message: 'Failed to start TTS streaming'
      });
    }
  }

  /**
   * 実際のTTS処理
   */
  async performTTS(text, voice, options = {}) {
    try {
      // External TTS service
      const ttsApiUrl = process.env.TTS_API_URL;
      
      if (ttsApiUrl) {
        return await this.callExternalTTS(ttsApiUrl, text, voice, options);
      }
      
      // Local TTS engine
      try {
        return await this.performLocalTTS(text, voice, options);
      } catch (localError) {
        console.error('Local TTS failed:', localError);
        
        // Fallback TTS
        return await this.generateFallbackTTS(text, options);
      }
    } catch (error) {
      console.error('All TTS methods failed:', error);
      throw new Error('TTS processing failed');
    }
  }

  /**
   * External TTS API call
   */
  async callExternalTTS(ttsApiUrl, text, voice, options) {
    const payload = {
      text,
      voice: voice || 'ja-JP-Wavenet-A',
      audioConfig: {
        audioEncoding: options.format?.toUpperCase() || 'LINEAR16',
        speakingRate: options.speed || 1.0,
        pitch: options.pitch || 0.0,
        sampleRateHertz: 16000
      }
    };

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.TTS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.TTS_API_KEY}`;
    }

    const startTime = Date.now();
    const response = await fetch(ttsApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`TTS API failed: ${response.status}`);
    }

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    return {
      base64: result.audioContent || result.audio || result.data,
      format: options.format || 'wav',
      duration: this.estimateAudioDuration(text),
      voice: voice || 'default',
      processingTime
    };
  }

  /**
   * Local TTS engine (espeak, festival, etc.)
   */
  async performLocalTTS(text, voice, options) {
    // This would integrate with local TTS engines
    // For example: espeak, festival, SAPI on Windows
    
    try {
      const { exec } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      
      // Generate temporary file
      const tempFile = path.join(__dirname, '../../temp', `tts_${Date.now()}.wav`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Use espeak command (if available)
      const command = `espeak "${text}" -w "${tempFile}" -v ja+f3 -s 150`;
      
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`espeak failed: ${error.message}`));
            return;
          }

          try {
            const audioBuffer = fs.readFileSync(tempFile);
            const base64Audio = audioBuffer.toString('base64');
            
            // Clean up temp file
            fs.unlinkSync(tempFile);
            
            resolve({
              base64: base64Audio,
              format: 'wav',
              duration: this.estimateAudioDuration(text),
              voice: 'espeak-ja',
              processingTime: 500
            });
          } catch (fileError) {
            reject(new Error(`File processing failed: ${fileError.message}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Local TTS setup failed: ${error.message}`);
    }
  }

  /**
   * Fallback TTS (mock audio)
   */
  async generateFallbackTTS(text, options) {
    // Generate a simple tone or return mock audio data
    const mockAudioBase64 = this.generateMockAudio(text.length);
    
    return {
      base64: mockAudioBase64,
      format: options.format || 'wav',
      duration: this.estimateAudioDuration(text),
      voice: 'mock-voice',
      processingTime: 100
    };
  }

  /**
   * ストリーミングTTS処理
   */
  async performStreamingTTS(text, voice, format, userId, jobId, io) {
    try {
      // テキストを文章単位で分割
      const sentences = this.splitTextToSentences(text);
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        try {
          // 各文章を音声合成
          const audioResult = await this.performTTS(sentence, voice, { format });
          
          // WebSocket経由でチャンク送信
          io.to(`user_${userId}`).emit('tts_audio_chunk', {
            jobId,
            chunkIndex: i,
            audioData: audioResult.base64,
            format: audioResult.format,
            isLast: i === sentences.length - 1,
            timestamp: new Date().toISOString()
          });
          
          // 適度な間隔をあける
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (chunkError) {
          console.error(`TTS chunk ${i} failed:`, chunkError);
          
          // エラーチャンクを送信
          io.to(`user_${userId}`).emit('tts_error', {
            jobId,
            chunkIndex: i,
            error: 'Chunk processing failed',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // 完了通知
      io.to(`user_${userId}`).emit('tts_complete', {
        jobId,
        totalChunks: sentences.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Streaming TTS failed:', error);
      
      io.to(`user_${userId}`).emit('tts_error', {
        jobId,
        error: 'Streaming TTS failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 利用可能な音声リスト取得
   */
  async getVoiceList() {
    const standardVoices = [
      {
        id: 'ja-JP-Wavenet-A',
        name: '日本語 (女性A)',
        language: 'ja-JP',
        gender: 'female',
        quality: 'high'
      },
      {
        id: 'ja-JP-Wavenet-B',
        name: '日本語 (男性A)',
        language: 'ja-JP',
        gender: 'male',
        quality: 'high'
      },
      {
        id: 'ja-JP-Wavenet-C',
        name: '日本語 (女性B)',
        language: 'ja-JP',
        gender: 'female',
        quality: 'high'
      },
      {
        id: 'en-US-Wavenet-A',
        name: 'English (Female)',
        language: 'en-US',
        gender: 'female',
        quality: 'high'
      }
    ];

    // Add local voices if available
    try {
      const localVoices = await this.getLocalVoices();
      return [...standardVoices, ...localVoices];
    } catch (error) {
      console.log('Local voices not available:', error.message);
      return standardVoices;
    }
  }

  /**
   * ローカル音声エンジンの音声取得
   */
  async getLocalVoices() {
    // This would query local TTS engines for available voices
    return [
      {
        id: 'espeak-ja',
        name: 'eSpeak 日本語',
        language: 'ja-JP',
        gender: 'neutral',
        quality: 'standard'
      }
    ];
  }

  /**
   * テキストを文章に分割
   */
  splitTextToSentences(text) {
    // 日本語の文区切り
    return text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
  }

  /**
   * 音声の推定長さを計算
   */
  estimateAudioDuration(text) {
    // 1分間に約300文字として計算
    const charactersPerMinute = 300;
    const durationMinutes = text.length / charactersPerMinute;
    return Math.max(1, Math.round(durationMinutes * 60 * 100) / 100); // seconds
  }

  /**
   * モック音声データ生成
   */
  generateMockAudio(textLength) {
    // WAVヘッダー付きの無音データを生成
    const sampleRate = 16000;
    const duration = Math.min(10, Math.max(1, textLength / 50)); // 文字数に基づく長さ
    const numSamples = Math.floor(sampleRate * duration);
    
    // 簡単なWAVファイル構造
    const buffer = Buffer.alloc(44 + numSamples * 2);
    
    // WAVヘッダー
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);
    
    // 低音のトーン生成（無音ではなく確認できる音）
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1 * 32767;
      buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
    }
    
    return buffer.toString('base64');
  }
}

module.exports = new TTSController();
