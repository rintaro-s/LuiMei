/**
 * Chat Controller - Simplified for immediate functionality
 */

class ChatController {

  async processChat(req, res) {
    try {
      const {
        text,
        role_sheet = {},
        history = [],
        compressed_memory = '',
        options = {}
      } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text message is required'
        });
      }

      // Mock AI processing for client.py compatibility
      const aiResponse = {
        response: this.generateMockResponse(text),
        emotion: {
          dominant: role_sheet.mood || 'neutral',
          confidence: 0.85
        },
        context: {
          role: role_sheet.role || 'assistant',
          mood: role_sheet.mood || 'friendly'
        },
        metadata: {
          processingTime: Math.floor(100 + Math.random() * 400),
          timestamp: new Date().toISOString(),
          model: 'lumimei-core-v1',
          tokensUsed: Math.floor(text.length / 4) // Rough estimate
        }
      };

      // Add debug info if requested
      if (options.includeDebug) {
        aiResponse.debug = {
          inputText: text,
          historyLength: history.length,
          memoryLength: compressed_memory.length,
          roleSheet: role_sheet
        };
      }

      res.json({
        success: true,
        ...aiResponse
      });

    } catch (error) {
      console.error('Chat processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Chat processing failed',
        message: 'An error occurred while processing your chat message'
      });
    }
  }
  async sendMessage(req, res) {
    try {
      const { userId, message, context = {} } = req.body;
      
      if (!userId || !message) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['userId', 'message']
        });
      }

      // Mock AI response
      const aiResponse = {
        content: this.generateMockResponse(message),
        type: 'text',
        emotion: { dominant: 'neutral', confidence: 0.85 }
      };

      res.json({
        success: true,
        response: aiResponse,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Chat controller error:', error);
      res.status(500).json({
        error: 'Failed to process message',
        message: error.message
      });
    }
  }

  async getChatHistory(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Mock chat history
      const history = [];
      for (let i = 0; i < Math.min(limit, 10); i++) {
        history.push({
          id: `msg_${Date.now() - i * 1000}`,
          userId,
          message: `Sample message ${i + 1}`,
          response: `Sample response ${i + 1}`,
          timestamp: new Date(Date.now() - i * 60000).toISOString()
        });
      }

      res.json({
        success: true,
        data: history,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });

    } catch (error) {
      console.error('Get chat history error:', error);
      res.status(500).json({
        error: 'Failed to retrieve chat history',
        message: error.message
      });
    }
  }

  async searchChatHistory(req, res) {
    try {
      const { userId } = req.params;
      const { query, limit = 20 } = req.query;

      if (!query) {
        return res.status(400).json({
          error: 'Search query is required'
        });
      }

      // Mock search results
      const results = [{
        id: `search_result_1`,
        userId,
        message: `Message containing "${query}"`,
        response: `Response for "${query}"`,
        timestamp: new Date().toISOString()
      }];

      res.json({
        success: true,
        data: results,
        query
      });

    } catch (error) {
      console.error('Search chat history error:', error);
      res.status(500).json({
        error: 'Failed to search chat history',
        message: error.message
      });
    }
  }

  async clearChatHistory(req, res) {
    try {
      const { userId } = req.params;

      res.json({
        success: true,
        message: 'Chat history cleared successfully'
      });

    } catch (error) {
      console.error('Clear chat history error:', error);
      res.status(500).json({
        error: 'Failed to clear chat history',
        message: error.message
      });
    }
  }

  /**
   * Generate mock AI response
   */
  generateMockResponse(input) {
    const responses = [
      `「${input}」について理解しました。`,
      `${input}に関してお答いたします。`,
      `そうですね、${input}についてですが...`,
      `${input}というご質問ですね。`,
      `${input}について詳しく説明させていただきます。`,
      `なるほど、${input}に興味がおありなんですね。`,
      `${input}について私の見解をお話しします。`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get compressed memory
   */
  async getCompressedMemory(req, res) {
    try {
      res.json({
        success: true,
        compressed_memory: 'Mock compressed memory data'
      });
    } catch (error) {
      console.error('Get compressed memory error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compressed memory'
      });
    }
  }

  /**
   * Compress memory
   */
  async compressMemory(req, res) {
    try {
      res.json({
        success: true,
        message: 'Memory compressed successfully',
        compressed_memory: 'Compressed memory result'
      });
    } catch (error) {
      console.error('Compress memory error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compress memory'
      });
    }
  }

  /**
   * Clear memory
   */
  async clearMemory(req, res) {
    try {
      res.json({
        success: true,
        message: 'Memory cleared successfully'
      });
    } catch (error) {
      console.error('Clear memory error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear memory'
      });
    }
  }
}

module.exports = new ChatController();
