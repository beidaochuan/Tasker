#Requires -Version 5.1
#Requires -RunAsAdministrator

[CmdletBinding()]
param(
  [string]$LanAddress,

  [string]$InstallPath = 'D:\app\Tasker',

  [ValidateRange(1, 65535)]
  [int]$Port = 3208,

  [ValidatePattern('^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$ReleaseTag,

  [string]$BackupPath,

  [switch]$SkipNodeInstall,

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

function ConvertTo-PlainText {
  param([Security.SecureString]$SecureValue)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Read-ConfirmedSecret {
  param(
    [string]$Prompt,
    [string]$ConfirmationPrompt
  )

  $first = Read-Host $Prompt -AsSecureString
  $second = Read-Host $ConfirmationPrompt -AsSecureString
  $firstText = ConvertTo-PlainText $first
  $secondText = ConvertTo-PlainText $second

  try {
    if ($firstText -cne $secondText) {
      throw '入力内容が一致しません。最初からやり直してください。'
    }
    return $firstText
  }
  finally {
    $secondText = $null
  }
}

function Assert-LanAddress {
  param([string]$Value)

  $address = $null
  if (-not [Net.IPAddress]::TryParse($Value, [ref]$address)) {
    throw 'LanAddressには、このWindows PCに設定されているIPv4アドレスを指定してください。'
  }
  if ($address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'LanAddressはIPv4アドレスで指定してください。'
  }
  if ([Net.IPAddress]::IsLoopback($address) -or $address.Equals([Net.IPAddress]::Any)) {
    throw 'LanAddressにはループバックや0.0.0.0ではなく、他のPCから到達できるアドレスを指定してください。'
  }

  $assignedAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -eq $Value } |
    Select-Object -First 1
  if (-not $assignedAddress) {
    throw "LanAddressはこのWindows PCに設定されていません: $Value"
  }

  $networkProfile = Get-NetConnectionProfile -InterfaceIndex $assignedAddress.InterfaceIndex -ErrorAction Stop | Select-Object -First 1
  $firewallProfile = switch ([string]$networkProfile.NetworkCategory) {
    'DomainAuthenticated' { 'Domain' }
    'Private' { 'Private' }
    'Public' { 'Public' }
    default {
      throw "Windowsのネットワークプロファイルを判定できません: $($networkProfile.NetworkCategory)"
    }
  }

  return [PSCustomObject]@{
    Address = $address.ToString()
    FirewallProfile = $firewallProfile
  }
}

function Read-LanAddress {
  Write-Step '社内LANで使用するIPアドレスを選択'
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object {
      $_.IPAddress -ne '127.0.0.1' -and
      -not $_.IPAddress.StartsWith('169.254.') -and
      -not $_.SkipAsSource
    } |
    Select-Object IPAddress, InterfaceAlias

  if (-not $candidates) {
    throw '利用可能なIPv4アドレスが見つかりません。ネットワーク接続を確認してください。'
  }

  Write-Host 'このWindows PCに設定されているIPアドレス:'
  $candidates | Format-Table -AutoSize | Out-Host
  Write-Host '（このPCだけで使う場合はそのままEnterを押してください）'
  $value = (Read-Host '社内の他のPCから接続するIPアドレスを入力').Trim()
  if ([string]::IsNullOrWhiteSpace($value)) {
    return '127.0.0.1'
  }
  return $value
}

function Get-ServiceByNameOrDisplayName {
  param([string]$Name)

  return Get-Service -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq $Name -or $_.DisplayName -eq $Name
  } | Select-Object -First 1
}

function Assert-PortAvailable {
  param([int]$TargetPort)

  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $TargetPort)
  try {
    $listener.Start()
  }
  catch {
    throw "TCP port $TargetPort はすでに使用されています。別のPortを指定してください。"
  }
  finally {
    $listener.Stop()
  }
}

function Refresh-ProcessPath {
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = @($machinePath, $userPath) -join ';'
}

function Get-NodeMajorVersion {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) {
    return 0
  }

  $version = (& $node.Source --version).Trim()
  if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v(?<major>[0-9]+)\.') {
    return 0
  }
  return [int]$Matches.major
}

function Install-NodeIfNeeded {
  $majorVersion = Get-NodeMajorVersion
  if ($majorVersion -ge 22) {
    Write-Host "Node.js v$majorVersion を使用します。"
    return
  }

  if ($SkipNodeInstall) {
    throw 'Node.js v22以上が見つかりません。Node.jsをインストールするか、SkipNodeInstallを外してください。'
  }

  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw 'Node.js v22以上とwingetが見つかりません。Node.js LTSを先にインストールしてください。'
  }

  Write-Step 'Node.js LTSをwingetでインストール'
  & $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements --silent
  if ($LASTEXITCODE -ne 0) {
    throw "Node.jsのインストールに失敗しました（終了コード: $LASTEXITCODE）。"
  }

  Refresh-ProcessPath
  $majorVersion = Get-NodeMajorVersion
  if ($majorVersion -lt 22) {
    throw 'Node.js v22以上を確認できません。ターミナルを開き直して再実行してください。'
  }
  Write-Host "Node.js v$majorVersion をインストールしました。"
}

function Invoke-GitHubApi {
  param([string]$Uri)

  return Invoke-RestMethod -Uri $Uri -Headers @{
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2026-03-10'
    'User-Agent' = 'Tasker-Windows-Setup'
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
    -Headers @{ 'User-Agent' = 'Tasker-Windows-Setup' }
  Assert-DownloadedDigest -Path $Destination -Digest $asset.digest -Label $expectedAssetName
  return [string]$release.tag_name
}

function Install-TaskerFiles {
  param(
    [string]$ArchivePath,
    [string]$Destination,
    [string]$StagingRoot
  )

  $expandedPath = Join-Path $StagingRoot 'expanded'
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $expandedPath

  $requiredFiles = @(
    'package.json',
    'package-lock.json',
    'dist\index.html',
    'dist-server\index.js',
    'scripts\service-install.cjs'
  )
  foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $expandedPath $relativePath) -PathType Leaf)) {
      throw "配布ZIPに必要なファイルがありません: $relativePath"
    }
  }

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Copy-Item -Path (Join-Path $expandedPath '*') -Destination $Destination -Recurse
}

function Install-TaskerDependencies {
  param([string]$Destination)

  Write-Step 'Taskerの実行用依存関係をインストール'
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) {
    throw 'npm.cmdが見つかりません。Node.jsのインストールを確認してください。'
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

function Invoke-WithTaskerEnvironment {
  param(
    [string]$Destination,
    [string]$Username,
    [string]$Password,
    [bool]$LocalhostOnly = $false
  )

  $names = @(
    'PORT',
    'TASKER_HOST',
    'TASKER_ADMIN_USERNAME',
    'TASKER_ADMIN_PASSWORD',
    'TASKER_COOKIE_SECURE'
  )
  $previous = @{}
  foreach ($name in $names) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  }

  try {
    $env:PORT = [string]$Port
    $env:TASKER_HOST = if ($LocalhostOnly) { '127.0.0.1' } else { '0.0.0.0' }
    $env:TASKER_ADMIN_USERNAME = $Username
    $env:TASKER_ADMIN_PASSWORD = $Password
    $env:TASKER_COOKIE_SECURE = 'false'

    Write-Step 'TaskerをWindowsサービスへ登録'
    $npm = Get-Command npm.cmd -ErrorAction Stop
    Push-Location $Destination
    try {
      & $npm.Source run service:install
      if ($LASTEXITCODE -ne 0) {
        throw "Taskerサービスの登録に失敗しました（終了コード: $LASTEXITCODE）。"
      }
    }
    finally {
      Pop-Location
    }
  }
  finally {
    foreach ($name in $names) {
      [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
  }
}

function Wait-TaskerReady {
  param([int]$TargetPort)

  $sessionUrl = "http://127.0.0.1:$TargetPort/api/auth/session"
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
      $session = Invoke-RestMethod -Uri $sessionUrl -TimeoutSec 2 -Headers @{
        'User-Agent' = 'Tasker-Windows-Setup'
      }
      if ($null -ne $session.isAuthenticated) {
        return
      }
    }
    catch {
      Start-Sleep -Seconds 1
    }
  }
  throw "Taskerの起動を確認できませんでした: $sessionUrl"
}

function Test-TaskerLogin {
  param(
    [int]$TargetPort,
    [string]$Username,
    [string]$Password
  )

  Write-Step 'Taskerの管理者ログインを確認'
  $loginBody = @{
    username = $Username
    password = $Password
  } | ConvertTo-Json -Compress

  $login = Invoke-RestMethod -Uri "http://127.0.0.1:$TargetPort/api/auth/login" `
    -Method Post `
    -ContentType 'application/json' `
    -Body $loginBody `
    -TimeoutSec 5 `
    -Headers @{ 'User-Agent' = 'Tasker-Windows-Setup' }

  if ($login.isAuthenticated -ne $true) {
    throw 'Taskerの管理者ログイン確認に失敗しました。'
  }

  # 確認用セッションをメモリから消し、実利用を未ログイン状態から始める。
  $service = Get-ServiceByNameOrDisplayName 'Tasker'
  if (-not $service) {
    throw '登録後のTaskerサービスが見つかりません。'
  }
  Restart-Service -InputObject $service
  Wait-TaskerReady -TargetPort $TargetPort
  Write-Host 'Taskerのログインと再起動を確認しました。'
}

function Install-LanFirewallRule {
  param(
    [int]$TargetPort,
    [string[]]$Profiles
  )

  $displayName = "Tasker (LAN TCP $TargetPort)"
  if (Get-NetFirewallRule -DisplayName $displayName -ErrorAction SilentlyContinue) {
    throw "同名のWindowsファイアウォール規則がすでにあります: $displayName"
  }

  Write-Step 'LANからの接続をWindowsファイアウォールで許可'
  New-NetFirewallRule `
    -DisplayName $displayName `
    -Group 'Tasker' `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $TargetPort `
    -Profile $Profiles `
    -RemoteAddress LocalSubnet | Out-Null

  Write-Host "$($Profiles -join '/')ネットワークのLocalSubnetだけを許可しました。"
}

function Invoke-ExistingTaskerUpdate {
  param([string]$ResolvedInstallPath)

  $updateScript = Join-Path $PSScriptRoot 'update-windows.ps1'
  if (-not (Test-Path -LiteralPath $updateScript -PathType Leaf)) {
    New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
    $updateScript = Join-Path $temporaryRoot 'tasker-update-windows.ps1'
    Invoke-WebRequest `
      -UseBasicParsing `
      -Uri 'https://raw.githubusercontent.com/beidaochuan/Tasker/main/scripts/update-windows.ps1' `
      -OutFile $updateScript `
      -Headers @{ 'User-Agent' = 'Tasker-Windows-Setup' }
  }

  $updateArguments = @{
    InstallPath = $ResolvedInstallPath
    Port = $Port
  }
  if ($ReleaseTag) {
    $updateArguments.ReleaseTag = $ReleaseTag
  }
  if ($BackupPath) {
    $updateArguments.BackupPath = $BackupPath
  }
  if ($KeepDownloadedFiles) {
    $updateArguments.KeepDownloadedFiles = $true
  }
  if ($Force) {
    $updateArguments.Force = $true
  }

  Write-Step '既存のTaskerを更新'
  & $updateScript @updateArguments
}

$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("tasker-setup-{0}" -f [Guid]::NewGuid().ToString('N'))
$adminPassword = $null

try {
  Assert-WindowsAdministrator
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  Write-Step 'インストール先を確認'
  Write-Host "インストール先 (既定: $InstallPath):"
  $inputPath = (Read-Host "  そのままEnterで既定を使用").Trim()
  if (-not [string]::IsNullOrWhiteSpace($inputPath)) {
    $InstallPath = $inputPath
  }
  $resolvedInstallPath = [IO.Path]::GetFullPath($InstallPath)
  $installRoot = [IO.Path]::GetPathRoot($resolvedInstallPath)
  if ($resolvedInstallPath.TrimEnd('\') -eq $installRoot.TrimEnd('\')) {
    throw 'ドライブ直下はInstallPathに指定できません。例: D:\app\Tasker'
  }
  Write-Host "インストール先: $resolvedInstallPath"
  if (Test-Path -LiteralPath $resolvedInstallPath) {
    Invoke-ExistingTaskerUpdate -ResolvedInstallPath $resolvedInstallPath
    return
  }

  if ([string]::IsNullOrWhiteSpace($LanAddress)) {
    $LanAddress = Read-LanAddress
  }
  $localhostOnly = ($LanAddress -eq '127.0.0.1')

  $resolvedLanAddress = $null
  $firewallProfiles = $null
  if (-not $localhostOnly) {
    $lanConnection = Assert-LanAddress $LanAddress
    $resolvedLanAddress = $lanConnection.Address
    $firewallProfiles = @($lanConnection.FirewallProfile)
    $firewallRuleName = "Tasker (LAN TCP $Port)"
    if (Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue) {
      throw "同名のWindowsファイアウォール規則がすでにあります: $firewallRuleName"
    }
  }
  $existingService = Get-ServiceByNameOrDisplayName 'Tasker'
  if ($existingService) {
    Write-Host 'Taskerサービスが残っています。削除してから再インストールします。' -ForegroundColor Yellow
    if ($existingService.Status -ne 'Stopped') {
      Stop-Service -InputObject $existingService -Force
    }
    & sc.exe delete $existingService.Name | Out-Null
    Start-Sleep -Seconds 1
  }
  Assert-PortAvailable -TargetPort $Port

  Write-Step 'ログイン情報を入力'
  $adminUsername = (Read-Host 'Tasker管理者ユーザー名').Trim()
  if ([string]::IsNullOrWhiteSpace($adminUsername) -or $adminUsername.Length -gt 256) {
    throw 'Tasker管理者ユーザー名は1〜256文字で入力してください。'
  }
  $adminPassword = Read-ConfirmedSecret `
    -Prompt 'Tasker管理者パスワード（12〜1024文字）' `
    -ConfirmationPrompt 'Tasker管理者パスワード（確認）'
  if ($adminPassword.Length -lt 12 -or $adminPassword.Length -gt 1024) {
    throw 'Tasker管理者パスワードは12〜1024文字で入力してください。'
  }

  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
  Install-NodeIfNeeded

  $localSource = Split-Path -Parent $PSScriptRoot
  $requiredLocalFiles = @(
    'package.json',
    'package-lock.json',
    'dist\index.html',
    'dist-server\index.js',
    'scripts\service-install.cjs'
  )
  $missingLocalFiles = $requiredLocalFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $localSource $_) -PathType Leaf) }
  if (-not $missingLocalFiles -and -not $Force) {
    Write-Step 'ZIPを解凍済みのファイルをそのまま使用'
    $installedTag = (Get-Content -LiteralPath (Join-Path $localSource 'package.json') -Raw | ConvertFrom-Json).version
    $installedTag = "v$installedTag"
    New-Item -ItemType Directory -Path $resolvedInstallPath -Force | Out-Null
    Copy-Item -Path (Join-Path $localSource '*') -Destination $resolvedInstallPath -Recurse -Exclude 'tasker.db', 'tasker.db-wal', 'tasker.db-shm'
  }
  else {
    $archivePath = Join-Path $temporaryRoot 'tasker-release.zip'
    $installedTag = Download-TaskerRelease -Destination $archivePath
    Install-TaskerFiles -ArchivePath $archivePath -Destination $resolvedInstallPath -StagingRoot $temporaryRoot
  }
  Install-TaskerDependencies -Destination $resolvedInstallPath
  Invoke-WithTaskerEnvironment `
    -Destination $resolvedInstallPath `
    -Username $adminUsername `
    -Password $adminPassword `
    -LocalhostOnly $localhostOnly
  Wait-TaskerReady -TargetPort $Port
  Test-TaskerLogin -TargetPort $Port -Username $adminUsername -Password $adminPassword
  if (-not $localhostOnly) {
    Install-LanFirewallRule -TargetPort $Port -Profiles $firewallProfiles
  }

  Write-Host "`nセットアップが完了しました。" -ForegroundColor Green
  Write-Host "Tasker: $installedTag"
  Write-Host "インストール先: $resolvedInstallPath"
  if ($localhostOnly) {
    Write-Host "URL: http://127.0.0.1:$Port"
    Write-Host 'このPCからのみアクセスできます。'
  }
  else {
    Write-Host "LAN URL: http://${resolvedLanAddress}:$Port"
    Write-Host '接続元は同じローカルサブネットに限定されています。ルーターでポート転送しないでください。'
  }
}
finally {
  $adminPassword = $null

  if (-not $KeepDownloadedFiles -and (Test-Path -LiteralPath $temporaryRoot)) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
  elseif ($KeepDownloadedFiles -and (Test-Path -LiteralPath $temporaryRoot)) {
    Write-Host "一時ファイルを保持しました: $temporaryRoot"
  }
}
