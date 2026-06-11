import { db } from '@/db/schema'
import type {
  ProjectRow,
  TopicRow,
  TaskRow,
  SubtaskRow,
  TagRow,
  TaskCompletionRow,
} from '@/db/schema'

const LAST_EXPORT_KEY = 'tasker_last_export'
const WARN_DAYS = 7
const MAX_IMPORT_SIZE = 50 * 1024 * 1024 // 50 MB

interface ImportPayload {
  version: number
  data: {
    projects?: ProjectRow[]
    topics?: TopicRow[]
    tasks?: TaskRow[]
    subtasks?: SubtaskRow[]
    tags?: TagRow[]
    task_completions?: TaskCompletionRow[]
  }
}

function isImportPayload(v: unknown): v is ImportPayload {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.version !== 'number') return false
  if (typeof obj.data !== 'object' || obj.data === null) return false
  return true
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

  if (!isImportPayload(parsed)) {
    throw new Error('無効なバックアップファイルです')
  }

  const {
    projects = [],
    topics = [],
    tasks = [],
    subtasks = [],
    tags = [],
    task_completions = [],
  } = parsed.data

  await db.transaction(
    'rw',
    [db.projects, db.topics, db.tasks, db.subtasks, db.tags, db.task_completions],
    async () => {
      await Promise.all([
        db.projects.clear(),
        db.topics.clear(),
        db.tasks.clear(),
        db.subtasks.clear(),
        db.tags.clear(),
        db.task_completions.clear(),
      ])
      await Promise.all([
        projects.length > 0 ? db.projects.bulkAdd(projects) : Promise.resolve(),
        topics.length > 0 ? db.topics.bulkAdd(topics) : Promise.resolve(),
        tasks.length > 0 ? db.tasks.bulkAdd(tasks) : Promise.resolve(),
        subtasks.length > 0 ? db.subtasks.bulkAdd(subtasks) : Promise.resolve(),
        tags.length > 0 ? db.tags.bulkAdd(tags) : Promise.resolve(),
        task_completions.length > 0
          ? db.task_completions.bulkAdd(task_completions)
          : Promise.resolve(),
      ])
    }
  )
}

export async function exportAllData(): Promise<void> {
  const [projects, topics, tasks, subtasks, tags, task_completions] = await Promise.all([
    db.projects.toArray(),
    db.topics.toArray(),
    db.tasks.toArray(),
    db.subtasks.toArray(),
    db.tags.toArray(),
    db.task_completions.toArray(),
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
