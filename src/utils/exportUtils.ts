import { db } from '@/db/schema'

const LAST_EXPORT_KEY = 'tasker_last_export'
const WARN_DAYS = 7

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
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))
}

export function shouldWarnAboutExport(): boolean {
  const last = localStorage.getItem(LAST_EXPORT_KEY)
  if (!last) return true
  const elapsed = Date.now() - Number(last)
  return elapsed > WARN_DAYS * 24 * 60 * 60 * 1000
}
