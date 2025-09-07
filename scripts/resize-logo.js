#!/usr/bin/env node

/**
 * Logo resizing script for Meimi project
 * Resizes logo.png to 500x500 pixels
 */

const fs = require('fs');
const path = require('path');

// Simple Node.js script (requires image processing library installation)
async function resizeLogo() {
  console.log('Starting logo resize process...');
  
  const logoPath = path.join(__dirname, '..', 'logo.png');
  const outputPath = path.join(__dirname, '..', 'logo-500x500.png');
  
  if (!fs.existsSync(logoPath)) {
    console.error('Error: logo.png not found in root directory');
    console.log('Please ensure logo.png exists in the project root');
    process.exit(1);
  }
  
  try {
    // Note: This requires sharp package to be installed
    // Run: npm install sharp
    const sharp = require('sharp');
    
    await sharp(logoPath)
      .resize(500, 500, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Logo resized successfully: ${outputPath}`);
    console.log('✓ Dimensions: 500x500 pixels');
    
    // Copy to Android resources
    const androidPath = path.join(__dirname, '..', 'Android-app', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png');
    const androidDir = path.dirname(androidPath);
    
    if (fs.existsSync(androidDir)) {
      fs.copyFileSync(outputPath, androidPath);
      console.log(`✓ Copied to Android resources: ${androidPath}`);
    }
    
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('Sharp module not found. Installing...');
      console.log('Run the following command to install dependencies:');
      console.log('  npm install sharp');
      console.log('');
      console.log('Alternative: Use online tool or image editor to resize logo.png to 500x500');
    } else {
      console.error('Error resizing logo:', error.message);
    }
    process.exit(1);
  }
}

// PowerShell alternative for Windows
function createPowerShellScript() {
  const psScript = `
# PowerShell script to resize logo using Windows built-in capabilities
param(
    [string]$InputPath = "logo.png",
    [string]$OutputPath = "logo-500x500.png",
    [int]$Width = 500,
    [int]$Height = 500
)

if (!(Test-Path $InputPath)) {
    Write-Error "Logo file not found: $InputPath"
    exit 1
}

Add-Type -AssemblyName System.Drawing

$image = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
$resized = New-Object System.Drawing.Bitmap($Width, $Height)
$graphics = [System.Drawing.Graphics]::FromImage($resized)

$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$graphics.DrawImage($image, 0, 0, $Width, $Height)

$resized.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$resized.Dispose()
$image.Dispose()

Write-Host "✓ Logo resized successfully: $OutputPath" -ForegroundColor Green
Write-Host "✓ Dimensions: \${Width}x\${Height} pixels" -ForegroundColor Green
`;

  const psPath = path.join(__dirname, 'resize-logo.ps1');
  fs.writeFileSync(psPath, psScript);
  console.log(`PowerShell script created: ${psPath}`);
  console.log('Run with: powershell -ExecutionPolicy Bypass -File resize-logo.ps1');
}

if (require.main === module) {
  // Check if running on Windows and create PowerShell alternative
  if (process.platform === 'win32') {
    createPowerShellScript();
  }
  
  resizeLogo().catch(console.error);
}

module.exports = { resizeLogo };
