import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const selfUpdateScriptPath = path.join(appRoot, 'scripts', 'setup-windows.ps1')
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

// PowerShellのシングルクォート文字列内で使うため、埋め込む値の ' を '' にエスケープする。
function escapeForPowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
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

    // Taskerサービス自身の子プロセスとして更新スクリプトを起動すると、スクリプトが
    // Stop-ServiceでTaskerサービスを止めた瞬間、サービスラッパー（WinSW）が
    // 子孫プロセスも含めて丸ごと強制終了してしまい、更新が完了しなくなる。
    // タスクスケジューラ経由で起動することで、Taskerサービスとは無関係な
    // プロセスツリーとして実行し、この巻き添え終了を回避する。
    // タスク名はポートで一意にし、同一マシンに複数インストールしている場合
    // （READMEに記載のある構成）でも他インスタンスの更新と衝突しないようにする。
    const updateTaskName = `TaskerSelfUpdate-${port}`
    // schtasksの/trに複雑な文字列を直接埋め込むと引用符の入れ子でパースが崩れるため、
    // 実行内容は一時的な.ps1ファイルに書き出し、/trはそれを-Fileで呼ぶだけにする。
    // ファイル名は実行ごとに一意にし、同時に複数の更新要求が来た場合の取り違えを避ける。
    const updateRunnerScriptPath = path.join(
      os.tmpdir(),
      `tasker-self-update-runner-${randomUUID()}.ps1`
    )
    const runnerScript =
      // 失敗・再試行を繰り返してもログが無制限に積み重ならないよう、実行のたびに
      // リセットしてから今回分だけを書き込む。
      `Set-Content -LiteralPath '${escapeForPowerShellSingleQuoted(updateLogPath)}' ` +
      `-Value "=== $(Get-Date -Format o) ===" -Encoding utf8\n` +
      `try {\n` +
      `  & '${escapeForPowerShellSingleQuoted(selfUpdateScriptPath)}' ` +
      `-InstallPath '${escapeForPowerShellSingleQuoted(appRoot)}' -Port ${port} ` +
      `*>> '${escapeForPowerShellSingleQuoted(updateLogPath)}'\n` +
      `}\n` +
      `finally {\n` +
      `  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue\n` +
      `}\n`

    function removeExistingUpdateTask(): void {
      try {
        execFileSync('schtasks.exe', ['/delete', '/tn', updateTaskName, '/f'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      } catch (err) {
        // タスクが存在しない場合もここに来るため警告扱い。想定外の失敗を診断できるように記録する。
        console.warn('[update] 既存の更新タスクの削除に失敗しました（未登録の場合は正常）', err)
      }
    }

    try {
      writeFileSync(updateRunnerScriptPath, runnerScript, 'utf8')
      removeExistingUpdateTask()
      execFileSync(
        'schtasks.exe',
        [
          '/create',
          '/tn',
          updateTaskName,
          '/tr',
          `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${updateRunnerScriptPath}"`,
          '/sc',
          'once',
          '/st',
          '23:59',
          '/ru',
          'SYSTEM',
          '/f',
        ],
        { windowsHide: true }
      )
      execFileSync('schtasks.exe', ['/run', '/tn', updateTaskName], { windowsHide: true })
      // タスク定義を消してもスケジューラが既に開始した実行インスタンスは継続するため、
      // ライブラリにタスク定義が残り続けないようここで片付ける。
      removeExistingUpdateTask()
      res.status(202).json({ started: true })
    } catch (err) {
      console.error('[update] 更新プログラムの起動に失敗しました', err)
      res
        .status(500)
        .json({ error: 'UPDATE_START_FAILED', message: '更新プログラムを起動できませんでした' })
    }
  })

  return router
}
