const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|tiff/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Advanced image analysis endpoint
router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    const user = req.user;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const { 
      extractText = false, 
      detectObjects = false, 
      analyzeColors = false,
      generateMetadata = true 
    } = req.body;

    const imageBuffer = req.file.buffer;
    const results = {};

    // Generate metadata using Sharp
    if (generateMetadata) {
      const metadata = await sharp(imageBuffer).metadata();
      results.metadata = {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        colorSpace: metadata.space,
        hasAlpha: metadata.hasAlpha,
        density: metadata.density,
        size: imageBuffer.length
      };
    }

    // Basic image stats
    const stats = await sharp(imageBuffer).stats();
    results.statistics = {
      channels: stats.channels.map(channel => ({
        min: channel.min,
        max: channel.max,
        mean: Math.round(channel.mean),
        std: Math.round(channel.std)
      })),
      isOpaque: stats.isOpaque,
      entropy: stats.entropy
    };

    // Dominant color analysis
    if (analyzeColors) {
      try {
        // Resize image for faster color analysis
        const resizedBuffer = await sharp(imageBuffer)
          .resize(100, 100, { fit: 'inside' })
          .raw()
          .toBuffer();

        // Simple dominant color extraction (simplified implementation)
        results.colors = {
          dominantColor: 'rgb(128, 128, 128)', // Placeholder
          palette: [], // Would implement proper color clustering
          message: 'Advanced color analysis requires additional computer vision libraries'
        };
      } catch (error) {
        results.colors = { error: 'Color analysis failed' };
      }
    }

    // Mock OCR (would integrate with Google Vision API in production)
    if (extractText) {
      results.textExtraction = {
        text: '',
        confidence: 0,
        boundingBoxes: [],
        message: 'OCR requires Google Vision API integration'
      };
    }

    // Mock object detection (would integrate with Google Vision API in production)
    if (detectObjects) {
      results.objectDetection = {
        objects: [],
        message: 'Object detection requires Google Vision API integration'
      };
    }

    // If an image is present, forward to local LMStudio for VLM-style processing
    try {

      const lmStudioUrl = process.env.LMSTUDIO_API_URL || 'http://127.0.0.1:8080/v1/generate';
      const lmStudioModel = process.env.LMSTUDIO_MODEL || 'gemma-3-12b-it@q4_k_m';

      // Prefer explicit characterPrompt (full system content). If not provided, construct from tone.
      const characterPrompt = req.body.characterPrompt || null;
      const characterTone = req.body.characterTone || (user && user.personality && user.personality.tone) || null;

      const systemContent = characterPrompt || (characterTone ? `私はあなたの兄です。${characterTone}で話して。あなたは${lmStudioModel}というLLMです。簡潔に話して` : `あなたは画像説明を行うアシスタントです。簡潔に、丁寧に答えてください。`);

      // Build messages array following LMStudio multimodal convention
      const messages = [];
      messages.push({ role: 'system', content: systemContent });

      const userText = req.body.prompt || req.body.promptText || 'この画像について説明してください。';
      const imageBase64 = imageBuffer.toString('base64');
      const imageDataUri = `data:${req.file.mimetype};base64,${imageBase64}`;

      // messages[1].content is an array with text and image_url entries per user's spec
      messages.push({ role: 'user', content: [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: imageDataUri } }
      ] });

      const payload = {
        model: lmStudioModel,
        messages,
        max_tokens: parseInt(req.body.max_tokens) || 1000,
        temperature: parseFloat(req.body.temperature) || 0.7
      };

      const headers = { 'Content-Type': 'application/json' };
      if (process.env.LMSTUDIO_API_KEY) headers['Authorization'] = `Bearer ${process.env.LMSTUDIO_API_KEY}`;

      const resp = await fetch(lmStudioUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (resp.ok) {
        const contentType = resp.headers.get('content-type') || '';
        let llmText = null;
        if (contentType.includes('application/json')) {
          const json = await resp.json();
          // Try common fields
          llmText = json.output || json.result || json.text || json.response || JSON.stringify(json);
        } else {
          llmText = await resp.text();
        }

        results.vlm_response = {
          raw: llmText,
          engine: lmStudioUrl
        };
      } else {
        results.vlm_response = { error: `LMStudio returned ${resp.status} ${resp.statusText}` };
      }
    } catch (e) {
      // Non-fatal: attach error info to results
      results.vlm_response = { error: e.message };
    }

    // Image processing capabilities demonstration
    results.processing = {
      thumbnailGenerated: true,
      optimizationApplied: false,
      filtersAvailable: ['blur', 'sharpen', 'brightness', 'contrast', 'saturation']
    };

    // Update user usage
    await user.updateUsage('imageAnalyses', 1);

    res.json({
      success: true,
      data: {
        analysis: results,
        originalFile: {
          name: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Image analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Image analysis failed',
      error: error.message
    });
  }
});

// Image processing endpoint
router.post('/process', upload.single('image'), async (req, res) => {
  try {
    const user = req.user;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const {
      operation = 'optimize',
      width,
      height,
      quality = 80,
      format = 'jpeg',
      blur,
      sharpen,
      brightness,
      contrast,
      saturation
    } = req.body;

    let processedImage = sharp(req.file.buffer);

    // Apply transformations based on operation
    switch (operation) {
      case 'resize':
        if (width || height) {
          processedImage = processedImage.resize(
            width ? parseInt(width) : null,
            height ? parseInt(height) : null,
            { fit: 'inside', withoutEnlargement: true }
          );
        }
        break;

      case 'thumbnail':
        processedImage = processedImage.resize(200, 200, { 
          fit: 'cover',
          position: 'centre'
        });
        break;

      case 'optimize':
        processedImage = processedImage.jpeg({ quality: parseInt(quality), progressive: true });
        break;

      case 'filter':
        if (blur) processedImage = processedImage.blur(parseFloat(blur));
        if (sharpen) processedImage = processedImage.sharpen();
        if (brightness || contrast || saturation) {
          processedImage = processedImage.modulate({
            brightness: brightness ? parseFloat(brightness) : 1,
            saturation: saturation ? parseFloat(saturation) : 1,
            lightness: contrast ? parseFloat(contrast) : 1
          });
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid operation specified'
        });
    }

    // Convert to specified format
    switch (format.toLowerCase()) {
      case 'png':
        processedImage = processedImage.png({ quality: parseInt(quality) });
        break;
      case 'webp':
        processedImage = processedImage.webp({ quality: parseInt(quality) });
        break;
      case 'jpeg':
      case 'jpg':
      default:
        processedImage = processedImage.jpeg({ quality: parseInt(quality) });
        break;
    }

    const outputBuffer = await processedImage.toBuffer();
    const outputMetadata = await sharp(outputBuffer).metadata();

    res.json({
      success: true,
      data: {
        processedImage: {
          buffer: outputBuffer.toString('base64'),
          metadata: {
            format: outputMetadata.format,
            width: outputMetadata.width,
            height: outputMetadata.height,
            size: outputBuffer.length
          }
        },
        operation: {
          type: operation,
          parameters: req.body,
          originalSize: req.file.size,
          processedSize: outputBuffer.length,
          compressionRatio: (req.file.size / outputBuffer.length).toFixed(2)
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Image processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Image processing failed',
      error: error.message
    });
  }
});

// Batch image processing
router.post('/batch-process', upload.array('images', 10), async (req, res) => {
  try {
    const user = req.user;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    const { operation = 'optimize', ...params } = req.body;
    const results = [];

    for (const file of req.files) {
      try {
        let processedImage = sharp(file.buffer);
        
        // Apply basic optimization for batch processing
        if (operation === 'optimize') {
          processedImage = processedImage.jpeg({ 
            quality: parseInt(params.quality) || 80, 
            progressive: true 
          });
        } else if (operation === 'thumbnail') {
          processedImage = processedImage.resize(200, 200, { 
            fit: 'cover',
            position: 'centre'
          });
        }

        const outputBuffer = await processedImage.toBuffer();
        const outputMetadata = await sharp(outputBuffer).metadata();

        results.push({
          originalName: file.originalname,
          originalSize: file.size,
          processedSize: outputBuffer.length,
          metadata: {
            width: outputMetadata.width,
            height: outputMetadata.height,
            format: outputMetadata.format
          },
          processedImage: outputBuffer.toString('base64')
        });

      } catch (error) {
        results.push({
          originalName: file.originalname,
          error: error.message,
          processed: false
        });
      }
    }

    // Update user usage
    await user.updateUsage('imageAnalyses', req.files.length);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          totalFiles: req.files.length,
          successfullyProcessed: results.filter(r => !r.error).length,
          errors: results.filter(r => r.error).length
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch image processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Batch image processing failed',
      error: error.message
    });
  }
});

module.exports = router;
