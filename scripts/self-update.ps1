#Requires -Version 5.1
#Requires -RunAsAdministrator

# Windowsサービスから自己更新するためのエントリーポイント。
# 既存インストール先の scripts\setup-windows.ps1 をそのまま実行すると、
# InstallPathとローカルソース（このスクリプト自身の配置場所）が同一と判定され、
# GitHub Releaseの再ダウンロードが必要な自己更新特有のパスに乗らない問題があった。
# そのため、最新リリースを別の一時フォルダへダウンロード・展開し、
# その中の setup-windows.ps1 を呼び出す。

[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$InstallPath,

  [Parameter(Mandatory)]
  [ValidateRange(1, 65535)]
  [int]$Port,

  [ValidatePattern('^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$ReleaseTag,

  [string]$Token
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

function Invoke-GitHubApi {
  param([string]$Uri)

  $headers = @{
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2026-03-10'
    'User-Agent' = 'Tasker-Self-Update'
  }
  $resolvedToken = if ($Token) { $Token } elseif ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } else { $null }
  if ($resolvedToken) {
    $headers['Authorization'] = "Bearer $resolvedToken"
    $resolvedToken = $null
  }
  return Invoke-RestMethod -Uri $Uri -Headers $headers
}

function Get-TaskerRelease {
  if ($ReleaseTag) {
    $encodedTag = [Uri]::EscapeDataString($ReleaseTag)
    return Invoke-GitHubApi "https://api.github.com/repos/beidaochuan/Tasker/releases/tags/$encodedTag"
  }
  return Invoke-GitHubApi 'https://api.github.com/repos/beidaochuan/Tasker/releases/latest'
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

$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("tasker-selfupdate-{0}" -f [Guid]::NewGuid().ToString('N'))
$succeeded = $false

try {
  Assert-WindowsAdministrator
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  New-Item -ItemType Directory -Path $temporaryRoot | Out-Null

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

  $archivePath = Join-Path $temporaryRoot 'tasker-release.zip'
  Invoke-WebRequest `
    -UseBasicParsing `
    -Uri $assets[0].browser_download_url `
    -OutFile $archivePath `
    -Headers @{ 'User-Agent' = 'Tasker-Self-Update' }
  Assert-DownloadedDigest -Path $archivePath -Digest $assets[0].digest -Label $expectedAssetName

  Write-Step 'ダウンロードしたファイルを展開'
  $expandedPath = Join-Path $temporaryRoot 'expanded'
  Expand-Archive -LiteralPath $archivePath -DestinationPath $expandedPath

  $extractedSetupScript = Join-Path $expandedPath 'scripts\setup-windows.ps1'
  if (-not (Test-Path -LiteralPath $extractedSetupScript -PathType Leaf)) {
    throw '配布ZIPにscripts\setup-windows.ps1が見つかりません。'
  }

  Write-Step '展開したセットアップスクリプトで更新を実行'
  $setupArguments = @{
    InstallPath = $InstallPath
    Port = $Port
  }
  if ($ReleaseTag) { $setupArguments.ReleaseTag = $ReleaseTag }
  if ($Token) { $setupArguments.Token = $Token }
  & $extractedSetupScript @setupArguments

  $succeeded = $true
}
finally {
  if ($succeeded -and (Test-Path -LiteralPath $temporaryRoot)) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
  elseif (Test-Path -LiteralPath $temporaryRoot) {
    Write-Host "一時ファイルを保持しました: $temporaryRoot"
  }
}
