// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildUpdateRunnerScript } from '../routes/update.js'

const describeOnWindows = process.platform === 'win32' ? describe : describe.skip

describe('自己更新ランナー', () => {
  it('ログ追記時のUTF-8エンコーディングを明示する', () => {
    const runnerScript = buildUpdateRunnerScript({
      updateLogPath: 'C:\\Temp\\update.log',
      updateScriptPath: 'C:\\Tasker\\setup-windows.ps1',
      installPath: 'C:\\Tasker',
      port: 3209,
    })

    expect(runnerScript).toContain(
      "*>&1 | Out-File -LiteralPath 'C:\\Temp\\update.log' -Encoding utf8 -Append"
    )
    expect(runnerScript).not.toContain('*>>')
  })
})

describeOnWindows('Windows自己更新ランナー', () => {
  it('進捗ログをWindows PowerShell 5.1でもUTF-8で追記する', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'tasker-update-runner-test-'))
    const updateScriptPath = path.join(temporaryRoot, 'fake-update.ps1')
    const runnerScriptPath = path.join(temporaryRoot, 'runner.ps1')
    const updateLogPath = path.join(temporaryRoot, 'update.log')

    try {
      writeFileSync(
        updateScriptPath,
        "param([string]$InstallPath, [int]$Port)\nWrite-Host '==> download' -ForegroundColor Cyan\n",
        'utf8'
      )
      writeFileSync(
        runnerScriptPath,
        buildUpdateRunnerScript({
          updateLogPath,
          updateScriptPath,
          installPath: temporaryRoot,
          port: 3209,
        }),
        'utf8'
      )

      execFileSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', runnerScriptPath],
        { windowsHide: true }
      )

      const log = readFileSync(updateLogPath, 'utf8')
      const steps = [...log.matchAll(/^==> (.+)$/gm)].map((match) => match[1])
      expect(steps).toEqual(['download'])
      expect(log).not.toContain('\0')
      expect(existsSync(runnerScriptPath)).toBe(false)
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })
})
