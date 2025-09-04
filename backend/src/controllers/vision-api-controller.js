/**
 * Vision API Controller - CLIENT COMPATIBLE VERSION
 * Implements vision/analyze endpoint with client-compatible response format
 */

// Generate unique message ID
function generateMessageId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Analyze image endpoint - CLIENT COMPATIBLE VERSION
const analyzeImage = async (req, res) => {
  try {
    console.log('Image analysis request received');
    
    const { userId, imageData, prompt = '', options = {} } = req.body;

    // Validate required fields
    if (!userId || !imageData) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [
          { field: 'userId', message: 'userId is required' },
          { field: 'imageData', message: 'imageData is required' }
        ]
      });
    }

    // Mock image analysis
    const mockAnalysis = {
      objects: [
        { name: 'person', confidence: 0.95, bbox: [100, 50, 200, 300] },
        { name: 'table', confidence: 0.88, bbox: [0, 200, 400, 400] },
        { name: 'laptop', confidence: 0.82, bbox: [150, 180, 300, 250] }
      ],
      ocr: prompt.includes('文字') || prompt.includes('text') ? 'サンプルテキスト認識結果\n会議資料\n2025年9月' : '',
      scene: 'indoor_office',
      description: 'オフィス環境での人物が写っている画像です。デスクにはノートパソコンが置かれています。'
    };

    // CLIENT COMPATIBLE response format
    const responseData = {
      success: true,
      messageId: generateMessageId(),
      result: mockAnalysis,
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Math.floor(Math.random() * 1000) + 500,
        userId,
        prompt: prompt || 'auto_analysis'
      }
    };

    console.log('Image analysis completed for user:', userId);
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Image analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Image analysis failed',
      details: [{ field: 'server', message: 'An error occurred during image analysis' }]
    });
  }
};

module.exports = {
  analyzeImage
};
