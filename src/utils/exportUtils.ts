import { apiFetch, apiFetchNoContent } from '@/repositories/apiFetch'
import {
  completionsWireResponseSchema,
  projectsWireResponseSchema,
  subtasksWireResponseSchema,
  tagsWireResponseSchema,
  tasksWireResponseSchema,
  topicsWireResponseSchema,
} from '@/repositories/apiResponseSchemas'
import type { output, ZodTypeAny } from 'zod'

const LAST_EXPORT_KEY = 'tasker_last_export'
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
  const [projects, topics, tasks, subtasks, tags, task_completions] = await Promise.all([
    fetchOrThrow('/api/projects', projectsWireResponseSchema),
    fetchOrThrow('/api/topics', topicsWireResponseSchema),
    fetchOrThrow('/api/tasks', tasksWireResponseSchema),
    fetchOrThrow('/api/subtasks', subtasksWireResponseSchema),
    fetchOrThrow('/api/tags', tagsWireResponseSchema),
    fetchOrThrow('/api/completions', completionsWireResponseSchema),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    data: { projects, topics, tasks, subtasks, tags, task_completions },
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
