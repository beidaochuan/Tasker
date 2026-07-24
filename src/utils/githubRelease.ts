const GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/beidaochuan/Tasker/releases/latest'

export interface GitHubRelease {
  version: string
  url: string
}

interface GitHubReleaseResponse {
  tag_name?: unknown
  html_url?: unknown
}

function parseVersion(value: string): number[] | null {
  const normalized = value.trim().replace(/^v/i, '')
  if (!/^\d+(?:\.\d+)*(?:[-+].*)?$/.test(normalized)) return null

  return normalized.split(/[+-]/, 1)[0].split('.').map(Number)
}

/** Returns true only when the GitHub release is newer than the running app. */
export function isNewerVersion(latestVersion: string, currentVersion: string): boolean {
  const latest = parseVersion(latestVersion)
  const current = parseVersion(currentVersion)
  if (!latest || !current) return false

  const length = Math.max(latest.length, current.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (latest[index] ?? 0) - (current[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return false
}

export async function fetchLatestGitHubRelease(signal?: AbortSignal): Promise<GitHubRelease> {
  const response = await fetch(GITHUB_RELEASES_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  })
  if (!response.ok)
    throw new Error(`GitHub Releases の取得に失敗しました（HTTP ${response.status}）`)

  const data: GitHubReleaseResponse = await response.json()
  if (typeof data.tag_name !== 'string' || typeof data.html_url !== 'string') {
    throw new Error('GitHub Releases の応答が不正です')
  }

  return { version: data.tag_name, url: data.html_url }
}
