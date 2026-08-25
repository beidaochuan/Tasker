import { apiFetch, apiFetchNoContent } from '@/repositories/apiFetch'
import {
  commentsWireResponseSchema,
  completionsWireResponseSchema,
  projectsWireResponseSchema,
  subtasksWireResponseSchema,
  tagsWireResponseSchema,
  tasksWireResponseSchema,
  taskRelationsWireResponseSchema,
  topicsWireResponseSchema,
} from '@/repositories/apiResponseSchemas'
import { formatDateInput } from '@/utils/dateUtils'
import type { output, ZodTypeAny } from 'zod'

const LAST_EXPORT_KEY = 'tasker_last_export'
const LAST_AUTO_BACKUP_KEY = 'tasker_last_auto_backup_date'
const WARN_DAYS = 7
const MAX_IMPORT_SIZE = 50 * 1024 * 1024 // 50 MB

async function fetchOrThrow<TSchema extends ZodTypeAny>(
  path: string,
  responseSchema: TSchema,
  init?: RequestInit
): Promise<output<TSchema>> {
  const r = await apiFetch(path, { responseSchema, init })
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export async function importAllData(file: File): Promise<void> {
  if (file.size > MAX_IMPORT_SIZE) {
    throw new Error('ファイルサイズが大きすぎます（上限 50 MB）')
  }

  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('JSON の解析に失敗しました。ファイルが壊れている可能性があります')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).version !== 'number'
  ) {
    throw new Error('無効なバックアップファイルです')
  }

  const imported = await apiFetchNoContent('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  })
  if (!imported.ok) throw new Error(imported.error.message)
}

export async function exportAllData(): Promise<void> {
  const [projects, topics, tasks, subtasks, tags, task_completions, task_comments, task_relations] =
    await Promise.all([
      fetchOrThrow('/api/projects', projectsWireResponseSchema),
      fetchOrThrow('/api/topics', topicsWireResponseSchema),
      fetchOrThrow('/api/tasks', tasksWireResponseSchema),
      fetchOrThrow('/api/subtasks', subtasksWireResponseSchema),
      fetchOrThrow('/api/tags', tagsWireResponseSchema),
      fetchOrThrow('/api/completions', completionsWireResponseSchema),
      fetchOrThrow('/api/comments', commentsWireResponseSchema),
      fetchOrThrow('/api/tasks/relations', taskRelationsWireResponseSchema),
    ])

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    data: {
      projects,
      topics,
      tasks,
      subtasks,
      tags,
      task_completions,
      task_comments,
      task_relations,
    },
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tasker-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))
}

export function shouldWarnAboutExport(): boolean {
  const last = localStorage.getItem(LAST_EXPORT_KEY)
  if (!last) return true
  const elapsed = Date.now() - Number(last)
  return elapsed > WARN_DAYS * 24 * 60 * 60 * 1000
}

let dailyBackupPromise: Promise<boolean> | null = null

// issue #14: その日の初回起動時に、JSONエクスポートと同じ処理で自動バックアップする。
// exportAllData() は LAST_EXPORT_KEY も更新するため、自動バックアップが走った日は
// 「最後のエクスポートから7日以上」の手動バックアップ警告(shouldWarnAboutExport)も
// 連動してリセットされる。実際にバックアップが行われている以上これは意図した挙動。
// 複数タブを同時に開いた場合はタブごとに1回実行され得るが、読み取り専用の処理であり
// データ破壊は起きないため許容する。
// なお a.click() によるダウンロードはブラウザにブロックされても例外を投げないため、
// 実際にファイルが保存されたことまでは保証できない（ブラウザの制約）。
// 戻り値: 実際にバックアップを実行したか(true)、その日すでに実行済みでスキップしたか(false)。
// 呼び出し元がユーザーへの通知を「実行した時だけ」出せるようにするための情報。
export function runDailyBackupIfNeeded(): Promise<boolean> {
  const today = formatDateInput(new Date())
  if (localStorage.getItem(LAST_AUTO_BACKUP_KEY) === today) return Promise.resolve(false)
  if (dailyBackupPromise) return dailyBackupPromise

  dailyBackupPromise = exportAllData()
    .then(() => {
      localStorage.setItem(LAST_AUTO_BACKUP_KEY, today)
      return true
    })
    .finally(() => {
      dailyBackupPromise = null
    })
  return dailyBackupPromise
}
