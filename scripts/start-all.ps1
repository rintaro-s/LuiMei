<#
Start-all script for LumiMei project (Windows PowerShell)
- Starts MongoDB Docker container named "meimi-mongo" if not running
- Waits for MongoDB port to be available
- Installs backend dependencies if needed and starts backend (node src/app.js)
- Optionally builds & installs Android app via gradle (installDebug)

Usage:
  .\start-all.ps1 [-SkipAndroid]

Run from repository root or from scripts folder; script locates repo root based on its own path.
#>

param(
  [switch]$SkipAndroid
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Compute paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$RepoRoot = $RepoRoot.ProviderPath
$LogDir = Join-Path $RepoRoot 'logs'
If (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$StartLog = Join-Path $LogDir 'start-all.log'

function Log {
  param([string]$msg)
  $line = "[$(Get-Date -Format o)] $msg"
  Write-Output $line
  $line | Out-File -FilePath $StartLog -Append -Encoding utf8
}

Log "=== Starting LumiMei start-all script ==="
Log "Repo root: $RepoRoot"

# 1) Ensure Docker is available
try {
  docker version --format '{{.Server.Version}}' > $null 2>&1
  Log "Docker available"
} catch {
  Log "Docker not available or not running: $_"
  throw "Docker is required to run local MongoDB container. Start Docker Desktop and retry."
}

# 2) Ensure MongoDB container 'meimi-mongo' is running
function Start-MeimiMongoContainer {
  $name = 'meimi-mongo'
  $exists = docker ps -a --filter "name=$name" --format "{{.Names}}" | Select-String -Pattern "^$name$" -Quiet
  if (-not $exists) {
    Log "Mongo container not found. Creating and starting container '$name'..."
    docker run -d --name $name -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest | Out-Null
    Start-Sleep -Seconds 2
  } else {
    $running = docker ps --filter "name=$name" --format "{{.Names}}" | Select-String -Pattern "^$name$" -Quiet
    if (-not $running) {
      Log "Mongo container exists but is stopped. Starting container '$name'..."
      docker start $name | Out-Null
      Start-Sleep -Seconds 1
    } else {
      Log "Mongo container '$name' is already running"
    }
  }
}

Start-MeimiMongoContainer

# 3) Wait for MongoDB port 27017 to be available
function Wait-ForPort {
  param(
    [string]$TargetHost = 'localhost',
    [int]$Port = 27017,
    [int]$TimeoutSeconds = 30
  )
  $end = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $end) {
    try {
      $res = Test-NetConnection -ComputerName $TargetHost -Port $Port -WarningAction SilentlyContinue
      if ($res.TcpTestSucceeded) { return $true }
    } catch { }
    Start-Sleep -Seconds 1
  }
  return $false
}

Log "Waiting for MongoDB to accept connections on localhost:27017 (timeout 60s)"
$ok = Wait-ForPort -TargetHost 'localhost' -Port 27017 -TimeoutSeconds 60
if (-not $ok) {
  Log "MongoDB did not become available within timeout"
  throw "MongoDB not available"
}
Log "MongoDB is accepting connections"

# 4) Start backend
$BackendDir = Join-Path $RepoRoot 'backend'
if (-not (Test-Path $BackendDir)) { throw "Cannot find backend directory: $BackendDir" }

# Install dependencies if node_modules missing
if (-not (Test-Path (Join-Path $BackendDir 'node_modules'))) {
  Log "Installing backend npm dependencies (this may take a while)"
  Push-Location $BackendDir
  npm install | Tee-Object -FilePath (Join-Path $LogDir 'npm-install.log') -Append
  Pop-Location
  Log "npm install completed"
} else {
  Log "node_modules already present; skipping npm install"
}

# Start backend process and redirect logs
$BackendOut = Join-Path $LogDir 'backend.out.log'
$BackendErr = Join-Path $LogDir 'backend.err.log'
Log "Starting backend (node src/app.js) in background, stdout -> $BackendOut, stderr -> $BackendErr"
$existing = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -ne $null } | Where-Object { $_.Path -match 'node' }
# We won't kill existing node processes here; instead start a new one dedicated to backend
Start-Process -FilePath 'node' -ArgumentList 'src/app.js' -WorkingDirectory $BackendDir -RedirectStandardOutput $BackendOut -RedirectStandardError $BackendErr -WindowStyle Minimized -PassThru | Out-Null
Start-Sleep -Seconds 2
Log "Backend start requested. Waiting 3s for initial logs..."
Start-Sleep -Seconds 3
if (Test-Path $BackendOut) { Get-Content $BackendOut -Tail 50 | ForEach-Object { Log "[backend] $_" } }

# 5) Optionally build & install Android app
if (-not $SkipAndroid) {
  $AndroidDir = Join-Path $RepoRoot 'Android-app'
  if (Test-Path $AndroidDir) {
    Log "Starting Android build & install (gradle installDebug). This may take several minutes."
    Push-Location $AndroidDir
    $gradle = Join-Path $AndroidDir 'gradlew.bat'
    if (-not (Test-Path $gradle)) { Log "gradlew.bat not found in $AndroidDir; skipping Android build"; Pop-Location } else {
      try {
        # Run gradle installDebug and stream output to log
        & $gradle installDebug 2>&1 | Tee-Object -FilePath (Join-Path $LogDir 'gradle-install.log')
        Log "Gradle installDebug finished"
      } catch {
        Log "Gradle build failed: $_"
      } finally {
        Pop-Location
      }
    }
  } else {
    Log "Android-app directory not found; skipping Android build"
  }
} else {
  Log "Skipping Android build as requested"
}

Log "=== start-all script finished (backend may still be running) ==="

# Print short summary
Get-Content $StartLog -Tail 50
