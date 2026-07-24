#Requires -Version 5.1
#Requires -RunAsAdministrator

[CmdletBinding()]
param(
  [string]$InstallPath = 'D:\app\Tasker',

  [ValidatePattern('^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$ReleaseTag,

  [string]$BackupPath,

  [ValidateRange(1, 65535)]
  [int]$Port = 3208,

  [ValidatePattern('^https?://')]
  [string]$HealthCheckUrl,

  [switch]$KeepDownloadedFiles,

  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step {
  param([string]$Message)

  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-WindowsAdministrator {
  if ($env:OS -ne 'Windows_NT') {
    throw 'このスクリプトはWindows専用です。'
  }

  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'PowerShellまたはWindows Terminalを管理者として開き直してください。'
  }
}

function Get-TaskerService {
  $service = Get-Service -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq 'Tasker' -or $_.DisplayName -eq 'Tasker'
  } | Select-Object -First 1
  if (-not $service) {
    throw 'Taskerサービスが見つかりません。新規インストールにはsetup-windows.ps1を使用してください。'
  }
  return $service
}

function Wait-ServiceStatus {
  param(
    [System.ServiceProcess.ServiceController]$Service,
    [System.ServiceProcess.ServiceControllerStatus]$Status,
    [int]$TimeoutSeconds = 30
  )

  for ($attempt = 1; $attempt -le $TimeoutSeconds; $attempt++) {
    $Service.Refresh()
    if ($Service.Status -eq $Status) {
      return
    }
    Start-Sleep -Seconds 1
  }
  throw "Taskerサービスが $Status 状態になりませんでした。"
}

function Invoke-GitHubApi {
  param([string]$Uri)

  return Invoke-RestMethod -Uri $Uri -Headers @{
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2026-03-10'
    'User-Agent' = 'Tasker-Windows-Updater'
  }
}

function Assert-DownloadedDigest {
  param(
    [string]$Path,
    [string]$Digest,
    [string]$Label
  )

  if (-not $Digest -or $Digest -notmatch '^sha256:(?<hash>[0-9a-fA-F]{64})$') {
    throw "$Label のGitHub ReleaseにSHA-256 digestがありません。安全のため処理を中止しました。"
  }

  $expected = $Matches.hash.ToLowerInvariant()
  $actual = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -cne $expected) {
    throw "$Label のSHA-256がGitHub Releaseの値と一致しません。"
  }
  Write-Host "$Label のSHA-256を検証しました。"
}

function Get-TaskerRelease {
  if ($ReleaseTag) {
    $encodedTag = [Uri]::EscapeDataString($ReleaseTag)
    return Invoke-GitHubApi "https://api.github.com/repos/beidaochuan/Tasker/releases/tags/$encodedTag"
  }
  return Invoke-GitHubApi 'https://api.github.com/repos/beidaochuan/Tasker/releases/latest'
}

function Download-TaskerRelease {
  param([string]$Destination)

  Write-Step 'GitHub ReleasesからTaskerをダウンロード'
  $release = Get-TaskerRelease
  if ($release.draft -or $release.prerelease) {
    throw "公開済みの正式Releaseではありません: $($release.tag_name)"
  }

  $expectedAssetName = "tasker-$($release.tag_name).zip"
  $assets = @($release.assets | Where-Object { $_.name -eq $expectedAssetName })
  if ($assets.Count -ne 1) {
    throw "GitHub Release $($release.tag_name) に $expectedAssetName が1件だけ存在することを確認できません。"
  }

  $asset = $assets[0]
  Invoke-WebRequest `
    -UseBasicParsing `
    -Uri $asset.browser_download_url `
    -OutFile $Destination `
    -Headers @{ 'User-Agent' = 'Tasker-Windows-Updater' }
  Assert-DownloadedDigest -Path $Destination -Digest $asset.digest -Label $expectedAssetName
  return [string]$release.tag_name
}

function Test-ReleaseFiles {
  param([string]$Path)

  $requiredFiles = @(
    'package.json',
    'package-lock.json',
    'dist\index.html',
    'dist-server\index.js',
    'scripts\service-install.cjs'
  )
  foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $Path $relativePath) -PathType Leaf)) {
      throw "配布ZIPに必要なファイルがありません: $relativePath"
    }
  }
}

function Copy-ApplicationFiles {
  param(
    [string]$Source,
    [string]$Destination
  )

  foreach ($fileName in @('package.json', 'package-lock.json', 'README.md', 'LICENSE')) {
    $sourceFile = Join-Path $Source $fileName
    if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
      Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $Destination $fileName) -Force
    }
  }

  foreach ($directoryName in @('dist', 'dist-server')) {
    $sourceDirectory = Join-Path $Source $directoryName
    $destinationDirectory = Join-Path $Destination $directoryName
    if (Test-Path -LiteralPath $destinationDirectory) {
      Remove-Item -LiteralPath $destinationDirectory -Recurse -Force
    }
    Copy-Item -LiteralPath $sourceDirectory -Destination $Destination -Recurse -Force
  }

  $sourceScripts = Join-Path $Source 'scripts'
  if (Test-Path -LiteralPath $sourceScripts -PathType Container) {
    $destinationScripts = Join-Path $Destination 'scripts'
    New-Item -ItemType Directory -Path $destinationScripts -Force | Out-Null
    Get-ChildItem -LiteralPath $sourceScripts -Force | Copy-Item -Destination $destinationScripts -Recurse -Force
  }
}

function Backup-DatabaseFiles {
  param(
    [string]$Source,
    [string]$Destination
  )

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  $foundDatabase = $false
  foreach ($fileName in @('tasker.db', 'tasker.db-wal', 'tasker.db-shm')) {
    $sourceFile = Join-Path $Source $fileName
    if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
      Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $Destination $fileName) -Force
      $foundDatabase = $true
    }
  }
  if (-not $foundDatabase) {
    throw "既存データベースが見つかりません: $(Join-Path $Source 'tasker.db')"
  }
}

function Invoke-ProductionInstall {
  param([string]$Destination)

  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) {
    throw 'npm.cmdが見つかりません。Node.js v22以上をインストールしてください。'
  }

  Push-Location $Destination
  try {
    & $npm.Source ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
      throw "npm ciに失敗しました（終了コード: $LASTEXITCODE）。"
    }
  }
  finally {
    Pop-Location
  }
}

function Wait-TaskerReady {
  param([string]$Url)

  for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
      $session = Invoke-RestMethod -Uri $Url -TimeoutSec 2 -Headers @{
        'User-Agent' = 'Tasker-Windows-Updater'
      }
      if ($null -ne $session.isAuthenticated) {
        return
      }
    }
    catch {
      Start-Sleep -Seconds 1
    }
  }
  throw "TaskerのHTTP起動を確認できませんでした: $Url"
}

$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("tasker-update-{0}" -f [Guid]::NewGuid().ToString('N'))
$succeeded = $false
$service = $null
$resolvedInstallPath = $null
$resolvedBackupPath = $null

try {
  Assert-WindowsAdministrator
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  if (-not $HealthCheckUrl) {
    $HealthCheckUrl = "http://127.0.0.1:$Port/api/auth/session"
  }

  $service = Get-TaskerService
  $resolvedInstallPath = [IO.Path]::GetFullPath($InstallPath)
  if (-not (Test-Path -LiteralPath $resolvedInstallPath -PathType Container)) {
    throw "InstallPathが見つかりません: $resolvedInstallPath"
  }
  Test-ReleaseFiles -Path $resolvedInstallPath

  $parentDirectory = Split-Path -Parent $resolvedInstallPath
  $backupName = "Tasker-backup-{0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss')
  $resolvedBackupPath = if ($BackupPath) {
    [IO.Path]::GetFullPath($BackupPath)
  }
  else {
    Join-Path $parentDirectory $backupName
  }
  if (Test-Path -LiteralPath $resolvedBackupPath) {
    throw "バックアップ先がすでに存在します: $resolvedBackupPath"
  }

  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
  $archivePath = Join-Path $temporaryRoot 'tasker-release.zip'
  $releaseTag = Download-TaskerRelease -Destination $archivePath
  $expandedPath = Join-Path $temporaryRoot 'expanded'
  Expand-Archive -LiteralPath $archivePath -DestinationPath $expandedPath
  Test-ReleaseFiles -Path $expandedPath

  $installedVersion = (Get-Content -LiteralPath (Join-Path $resolvedInstallPath 'package.json') -Raw | ConvertFrom-Json).version
  if ($releaseTag -eq "v$installedVersion" -and -not $Force) {
    Write-Host "Tasker $installedVersion はすでにインストールされています。強制更新するには -Force を指定してください。"
    $succeeded = $true
    return
  }

  Write-Step 'Taskerサービスを停止'
  if ($service.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
    Stop-Service -InputObject $service
    Wait-ServiceStatus -Service $service -Status ([System.ServiceProcess.ServiceControllerStatus]::Stopped)
  }

  Write-Step 'データベースをバックアップ'
  Backup-DatabaseFiles -Source $resolvedInstallPath -Destination $resolvedBackupPath

  $rollbackPath = Join-Path $temporaryRoot 'rollback'
  New-Item -ItemType Directory -Path $rollbackPath | Out-Null
  Copy-ApplicationFiles -Source $resolvedInstallPath -Destination $rollbackPath

  Write-Step "$releaseTag をインストール"
  $daemonPath = Join-Path $resolvedInstallPath 'dist-server\daemon'
  $daemonBackupPath = Join-Path $temporaryRoot 'daemon'
  if (Test-Path -LiteralPath $daemonPath -PathType Container) {
    Copy-Item -LiteralPath $daemonPath -Destination $daemonBackupPath -Recurse -Force
  }
  Copy-ApplicationFiles -Source $expandedPath -Destination $resolvedInstallPath
  if (Test-Path -LiteralPath $daemonBackupPath -PathType Container) {
    $daemonRestorePath = Join-Path $resolvedInstallPath 'dist-server\daemon'
    New-Item -ItemType Directory -Path $daemonRestorePath -Force | Out-Null
    Copy-Item -Path (Join-Path $daemonBackupPath '*') -Destination $daemonRestorePath -Recurse -Force
  }
  Invoke-ProductionInstall -Destination $resolvedInstallPath

  Write-Step 'Taskerサービスを起動'
  Start-Service -InputObject $service
  Wait-ServiceStatus -Service $service -Status ([System.ServiceProcess.ServiceControllerStatus]::Running)
  if ($HealthCheckUrl) {
    Wait-TaskerReady -Url $HealthCheckUrl
  }

  $succeeded = $true
  Write-Host "`nTaskerを${releaseTag}へ更新しました。" -ForegroundColor Green
  Write-Host '既存のWindowsサービス設定（管理者資格情報、ポート、LAN設定）は保持されています。'
}
catch {
  $updateError = $_
  Write-Warning "更新エラー: $($updateError.Exception.Message)"
  if ($service -and $resolvedInstallPath -and (Test-Path -LiteralPath (Join-Path $temporaryRoot 'rollback'))) {
    Write-Warning '更新に失敗したため、アプリケーションファイルを更新前の状態へ戻します。'
    try {
      if ($service.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
        Stop-Service -InputObject $service -ErrorAction SilentlyContinue
        Wait-ServiceStatus -Service $service -Status ([System.ServiceProcess.ServiceControllerStatus]::Stopped)
      }
      Copy-ApplicationFiles -Source (Join-Path $temporaryRoot 'rollback') -Destination $resolvedInstallPath
      Invoke-ProductionInstall -Destination $resolvedInstallPath
      Start-Service -InputObject $service
      Wait-ServiceStatus -Service $service -Status ([System.ServiceProcess.ServiceControllerStatus]::Running)
      Write-Warning '更新前のTaskerサービスを再起動しました。'
    }
    catch {
      throw "更新とロールバックに失敗しました。DBバックアップを使って手動復旧してください: $resolvedBackupPath`n元のエラー: $($updateError.Exception.Message)`nロールバックエラー: $($_.Exception.Message)"
    }
  }
  throw $updateError
}
finally {
  if ($succeeded -and -not $KeepDownloadedFiles) {
    if (Test-Path -LiteralPath $temporaryRoot) {
      Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
    if ($resolvedBackupPath -and (Test-Path -LiteralPath $resolvedBackupPath)) {
      Remove-Item -LiteralPath $resolvedBackupPath -Recurse -Force
    }
  }
  elseif (Test-Path -LiteralPath $temporaryRoot) {
    Write-Host "一時ファイルを保持しました: $temporaryRoot"
    if ($resolvedBackupPath -and (Test-Path -LiteralPath $resolvedBackupPath)) {
      Write-Host "データベースバックアップ: $resolvedBackupPath"
    }
  }
}
