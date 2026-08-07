import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const setupScriptPath = path.join(appRoot, 'scripts', 'setup-windows.ps1')

// node-windowsが登録するSERVICE_NAMEはDISPLAY_NAMEと異なる（例: "Tasker" -> "tasker.exe"）ため、
// 表示名から実際のサービス名を解決する。sc.exeの出力はASCII前提（encoding: 'utf8'）。
function findServiceName(nameOrDisplayName: string): string | null {
  let output: string
  try {
    output = execFileSync('sc.exe', ['query', 'type=', 'service', 'state=', 'all'], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 5000,
    })
  } catch {
    return null
  }

  let currentServiceName: string | null = null
  for (const line of output.split(/\r?\n/)) {
    const serviceNameMatch = /^SERVICE_NAME:\s*(.+)$/.exec(line)
    if (serviceNameMatch) {
      currentServiceName = serviceNameMatch[1].trim()
      if (currentServiceName === nameOrDisplayName) return currentServiceName
      continue
    }
    const displayNameMatch = /^DISPLAY_NAME:\s*(.+)$/.exec(line)
    if (
      displayNameMatch &&
      currentServiceName &&
      displayNameMatch[1].trim() === nameOrDisplayName
    ) {
      return currentServiceName
    }
  }
  return null
}

function updateUnavailableMessage(): string | null {
  if (process.platform !== 'win32') return 'この端末ではアプリ内更新を利用できません'
  if (!existsSync(setupScriptPath)) return 'セットアップスクリプトが見つかりません'
  if (!findServiceName('Tasker')) return 'Tasker の Windows サービスが見つかりません'
  try {
    execFileSync('net.exe', ['session'], { stdio: 'ignore', windowsHide: true })
  } catch {
    return 'Tasker サービスに更新に必要な管理者権限がありません'
  }
  return null
}

export function createUpdateRouter(port: number): Router {
  const router = Router()

  router.get('/status', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ canSelfUpdate: updateUnavailableMessage() === null })
  })

  router.post('/', (_req, res) => {
    const unavailable = updateUnavailableMessage()
    if (unavailable) {
      res.status(501).json({ error: 'UPDATE_UNAVAILABLE', message: unavailable })
      return
    }

    try {
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          setupScriptPath,
          '-InstallPath',
          appRoot,
          '-Port',
          String(port),
        ],
        { detached: true, stdio: 'ignore', windowsHide: true }
      )
      child.unref()
      res.status(202).json({ started: true })
    } catch {
      res
        .status(500)
        .json({ error: 'UPDATE_START_FAILED', message: '更新プログラムを起動できませんでした' })
    }
  })

  return router
}
