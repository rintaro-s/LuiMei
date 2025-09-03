/**
 * LumiMei OS Context Controller
 * コンテキスト・プレゼンス管理
 */

// 4) コンテキスト・プレゼンス更新
const updateContext = async (req, res) => {
  try {
    console.log('Context update request:', JSON.stringify(req.body, null, 2));

    const {
      userId,
      deviceId,
      context = {},
      sensors = {},
      timestamp
    } = req.body;

    // Validate required fields
    if (!userId || !deviceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId and deviceId are required'
        }
      });
    }

    // Mock context storage (in real implementation, save to database)
    const contextUpdate = {
      userId,
      deviceId,
      context: {
        battery: context.battery || null,
        net: context.net || null,
        lastLocation: context.lastLocation || null,
        focusMode: context.focusMode || false,
        ...context
      },
      sensors: {
        speechRate: sensors.speechRate || null,
        ambientNoiseDb: sensors.ambientNoiseDb || null,
        ...sensors
      },
      timestamp: timestamp || Date.now(),
      updatedAt: new Date().toISOString()
    };

    console.log('Context updated successfully for user:', userId);

    res.status(200).json({
      success: true,
      data: {
        userId,
        deviceId,
        updatedAt: contextUpdate.updatedAt
      }
    });

  } catch (error) {
    console.error('Context update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_ERROR',
        message: 'Failed to update context'
      }
    });
  }
};

// Get current context
const getContext = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deviceId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId is required'
        }
      });
    }

    // Mock context retrieval
    const mockContext = {
      userId,
      deviceId: deviceId || 'default',
      context: {
        battery: 0.86,
        net: 'wifi',
        lastLocation: {
          lat: 35.6,
          lon: 139.7,
          accuracyM: 50
        },
        focusMode: false
      },
      sensors: {
        speechRate: 1.1,
        ambientNoiseDb: 42
      },
      timestamp: Date.now() - 30000,
      updatedAt: new Date(Date.now() - 30000).toISOString()
    };

    res.status(200).json({
      success: true,
      data: mockContext
    });

  } catch (error) {
    console.error('Context get error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_ERROR',
        message: 'Failed to retrieve context'
      }
    });
  }
};

module.exports = {
  updateContext,
  getContext
};
