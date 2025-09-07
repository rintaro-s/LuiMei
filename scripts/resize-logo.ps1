
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
Write-Host "✓ Dimensions: ${Width}x${Height} pixels" -ForegroundColor Green
