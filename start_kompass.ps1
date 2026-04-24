param(
    [switch]$Stop,
    [switch]$Status,
    [switch]$NoBrowser,
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$logsDir = Join-Path $root 'logs'
$pidFile = Join-Path $root '.kompass-server.json'
$backendIndex = Join-Path $backendDir 'index.js'
$nodeInstallDir = 'C:\Program Files\nodejs'

if ((Test-Path $nodeInstallDir) -and (($env:Path -split ';') -notcontains $nodeInstallDir)) {
    $env:Path = "$nodeInstallDir;$env:Path"
}

function Get-NodeCommand {
    return (Get-Command node -ErrorAction Stop).Source
}

function Get-NpmCommand {
    return (Get-Command npm -ErrorAction Stop).Source
}

function Get-KompassState {
    if (-not (Test-Path $pidFile)) {
        return $null
    }

    try {
        return Get-Content $pidFile -Raw | ConvertFrom-Json
    } catch {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
        return $null
    }
}

function Get-KompassProcess {
    $state = Get-KompassState
    if (-not $state) {
        return $null
    }

    try {
        $process = Get-Process -Id $state.pid -ErrorAction Stop
        $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)"
        if ($cim.CommandLine -and $cim.CommandLine -like "*$backendIndex*") {
            return [pscustomobject]@{
                State = $state
                Process = $process
            }
        }
    } catch {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }

    return $null
}

function Stop-KompassProcess {
    $running = Get-KompassProcess
    if (-not $running) {
        Write-Output 'Kompass is not running.'
        return
    }

    Stop-Process -Id $running.Process.Id -Force
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Write-Output "Stopped Kompass process $($running.Process.Id)."
}

function Show-KompassStatus {
    $running = Get-KompassProcess
    if (-not $running) {
        Write-Output 'Kompass is not running.'
        return
    }

    $health = $null
    try {
        $health = Invoke-RestMethod "http://127.0.0.1:$($running.State.port)/api/health"
    } catch {
    }

    Write-Output 'Kompass status'
    Write-Output "App:    http://127.0.0.1:$($running.State.port)/"
    Write-Output "Health: http://127.0.0.1:$($running.State.port)/api/health"
    Write-Output "PID:    $($running.Process.Id)"
    Write-Output "Started: $($running.State.startedAt)"

    if ($health) {
        Write-Output "Ready:  $($health.ready)"
        Write-Output "GDELT:  $($health.sources.gdelt)"
        Write-Output "Finance:$($health.sources.finance)"
        Write-Output "Coverage: $($health.coverage.gdelt.countryCount) countries / $($health.coverage.gdelt.sourceCount) sources"
    } else {
        Write-Output 'Ready:  unknown'
        Write-Output 'Feeds:  health endpoint not reachable'
    }
}

function Invoke-Npm {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $npm = Get-NpmCommand
    Push-Location $WorkingDirectory
    try {
        & $npm @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "npm $($Arguments -join ' ') failed in $WorkingDirectory"
        }
    } finally {
        Pop-Location
    }
}

function Wait-ForHealth {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$Attempts = 60,
        [int]$DelaySeconds = 1
    )

    for ($index = 0; $index -lt $Attempts; $index++) {
        try {
            return Invoke-RestMethod $Url
        } catch {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "Timed out waiting for $Url"
}

function Wait-ForReady {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$Attempts = 45,
        [int]$DelaySeconds = 1
    )

    for ($index = 0; $index -lt $Attempts; $index++) {
        try {
            $health = Invoke-RestMethod $Url
            if ($health.ready) {
                return $health
            }
        } catch {
        }
        Start-Sleep -Seconds $DelaySeconds
    }

    return Invoke-RestMethod $Url
}

if ($Stop) {
    Stop-KompassProcess
    return
}

if ($Status) {
    Show-KompassStatus
    return
}

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root 'data') | Out-Null

$existing = Get-KompassProcess
if ($existing) {
    Write-Output "Kompass is already running on port $($existing.State.port)."
    Write-Output "URL: http://127.0.0.1:$($existing.State.port)/"
    if (-not $NoBrowser) {
        Start-Process "http://127.0.0.1:$($existing.State.port)/"
    }
    return
}

Write-Output 'Building frontend production bundle...'
Invoke-Npm -WorkingDirectory $frontendDir -Arguments @('run', 'build')

$outLog = Join-Path $logsDir 'backend.out.log'
$errLog = Join-Path $logsDir 'backend.err.log'
if (Test-Path $outLog) { Remove-Item $outLog -Force }
if (Test-Path $errLog) { Remove-Item $errLog -Force }

$node = Get-NodeCommand
$oldNodeEnv = $env:NODE_ENV
$oldPort = $env:PORT

try {
    $env:NODE_ENV = 'production'
    $env:PORT = [string]$Port

    $process = Start-Process `
        -FilePath $node `
        -ArgumentList $backendIndex `
        -WorkingDirectory $backendDir `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog
} finally {
    $env:NODE_ENV = $oldNodeEnv
    $env:PORT = $oldPort
}

$state = [pscustomobject]@{
    pid = $process.Id
    port = $Port
    startedAt = (Get-Date).ToString('o')
    outLog = $outLog
    errLog = $errLog
}
$state | ConvertTo-Json | Set-Content $pidFile

try {
    $health = Wait-ForHealth -Url "http://127.0.0.1:$Port/api/health"
    $health = Wait-ForReady -Url "http://127.0.0.1:$Port/api/health"
    $rootResponse = Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing
} catch {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

    Write-Output 'Kompass failed to start. Recent backend stderr:'
    if (Test-Path $errLog) {
        Get-Content $errLog -Tail 40
    }
    throw
}

Write-Output ''
Write-Output 'Kompass is running.'
Write-Output "App:    http://127.0.0.1:$Port/"
Write-Output "Health: http://127.0.0.1:$Port/api/health"
Write-Output "PID:    $($process.Id)"
Write-Output "Ready:  $($health.ready)"
Write-Output "GDELT:  $($health.sources.gdelt)"
Write-Output "Finance:$($health.sources.finance)"
Write-Output "Logs:   $outLog"
Write-Output ''
Write-Output 'To stop it later:'
Write-Output "powershell -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`" -Stop"

if ($rootResponse.StatusCode -eq 200 -and -not $NoBrowser) {
    Start-Process "http://127.0.0.1:$Port/"
}
