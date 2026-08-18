import { execFileSync, spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const selfUpdateScriptPath = path.join(appRoot, 'scripts', 'self-update.ps1')
const updateLogPath = path.join(os.tmpdir(), 'tasker-update.log')
const serverVersion = (
  JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8')) as { version: string }
).version

// node-windowsが登録するSERVICE_NAMEはDISPLAY_NAMEと異なる（例: "Tasker" -> "tasker.exe"）ため、
// 表示名から実際のサービス名を解決する。sc.exeの出力はASCII前提（encoding: 'utf8'）。
function findServiceName(nameOrDisplayName: string): string | null {
  const output = execFileSync('sc.exe', ['query', 'type=', 'service', 'state=', 'all'], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 5000,
  })

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
  if (!existsSync(selfUpdateScriptPath)) return '更新スクリプトが見つかりません'

  let serviceName: string | null
  try {
    serviceName = findServiceName('Tasker')
  } catch (err) {
    console.error('[update] sc.exeによるサービス一覧の取得に失敗しました', err)
    return 'Tasker の Windows サービスの確認に失敗しました'
  }
  if (!serviceName) return 'Tasker の Windows サービスが見つかりません'

  try {
    execFileSync('net.exe', ['session'], { stdio: 'ignore', windowsHide: true })
  } catch {
    // net sessionの失敗は管理者権限がないことの正常な検知方法であり、エラーではない
    return 'Tasker サービスに更新に必要な管理者権限がありません'
  }
  return null
}

export function createUpdateRouter(port: number): Router {
  const router = Router()

  router.get('/status', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ canSelfUpdate: updateUnavailableMessage() === null, version: serverVersion })
  })

  router.post('/', (_req, res) => {
    const unavailable = updateUnavailableMessage()
    if (unavailable) {
      res.status(501).json({ error: 'UPDATE_UNAVAILABLE', message: unavailable })
      return
    }

    let logFd: number
    try {
      logFd = openSync(updateLogPath, 'w')
    } catch (err) {
      console.error('[update] 更新ログファイルを作成できませんでした', err)
      res
        .status(500)
        .json({ error: 'UPDATE_START_FAILED', message: '更新プログラムを起動できませんでした' })
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
          selfUpdateScriptPath,
          '-InstallPath',
          appRoot,
          '-Port',
          String(port),
        ],
        { detached: true, stdio: ['ignore', logFd, logFd], windowsHide: true }
      )
      child.on('error', (err) => {
        console.error('[update] 更新プログラムの起動に失敗しました', err)
      })
      child.unref()
      res.status(202).json({ started: true })
    } catch (err) {
      console.error('[update] 更新プログラムの起動に失敗しました', err)
      res
        .status(500)
        .json({ error: 'UPDATE_START_FAILED', message: '更新プログラムを起動できませんでした' })
    } finally {
      closeSync(logFd)
    }
  })

  return router
}
