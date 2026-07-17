import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportAllData, importAllData } from './exportUtils'

const PROJECT = {
  id: 'project-1',
  name: 'Project',
  description: '',
  color: '#6366f1',
  status: 'active',
  isArchived: 1,
  createdAt: 1_000,
  updatedAt: 2_000,
  futureProjectField: { preserved: true },
}

const TOPIC = {
  id: 'topic-1',
  projectId: PROJECT.id,
  name: 'Topic',
  order: 0,
  createdAt: 3_000,
  futureTopicField: 'preserved',
}

const TASK = {
  id: 'task-1',
  topicId: TOPIC.id,
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: 4_000,
  startDate: 3_500,
  order: 0,
  ganttOrder: null,
  tags: ['tag-1'],
  repeatRule: null,
  statusChangedAt: 3_750,
  createdAt: 3_000,
  updatedAt: 4_000,
  futureTaskField: ['preserved'],
}

const SUBTASK = {
  id: 'subtask-1',
  taskId: TASK.id,
  title: 'Subtask',
  isDone: 0,
  order: 0,
  createdAt: 4_500,
  futureSubtaskField: 42,
}

const TAG = {
  id: 'tag-1',
  name: 'Tag',
  color: '#ef4444',
  futureTagField: false,
}

const COMPLETION = {
  id: 'completion-1',
  taskId: TASK.id,
  completedAt: 5_000,
  futureCompletionField: 'preserved',
}

const EXPORT_RESPONSES: Record<string, unknown> = {
  '/api/projects': [PROJECT],
  '/api/topics': [TOPIC],
  '/api/tasks': [TASK],
  '/api/subtasks': [SUBTASK],
  '/api/tags': [TAG],
  '/api/completions': [COMPLETION],
}

const IMPORT_PAYLOAD = {
  version: 1,
  exportedAt: '2026-07-17T00:00:00.000Z',
  data: {
    projects: [PROJECT],
    topics: [TOPIC],
    tasks: [TASK],
    subtasks: [SUBTASK],
    tags: [TAG],
    task_completions: [COMPLETION],
  },
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Request failed',
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

function noContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    statusText: 'No Content',
    json: vi.fn().mockRejectedValue(new Error('204レスポンスをJSONとして読んではならない')),
  } as unknown as Response
}

function mockExportFetch(overrides: Record<string, Response> = {}) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const overridden = overrides[path]
      if (overridden) return overridden
      if (!(path in EXPORT_RESPONSES)) return jsonResponse({ error: 'NOT_FOUND' }, 404)
      return jsonResponse(EXPORT_RESPONSES[path])
    })
}

function backupFile(payload: unknown = IMPORT_PAYLOAD): File {
  const text = JSON.stringify(payload)
  return {
    name: 'tasker-backup.json',
    size: text.length,
    type: 'application/json',
    text: vi.fn().mockResolvedValue(text),
  } as unknown as File
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Blobを読めませんでした'))
    )
    reader.readAsText(blob)
  })
}

describe('exportUtils', () => {
  const createObjectURLMock = vi.fn((_blob: Blob | MediaSource) => 'blob:tasker-backup')
  const revokeObjectURLMock = vi.fn((_url: string) => undefined)
  let clickedHref: string | undefined
  let clickedDownload: string | undefined

  beforeEach(() => {
    localStorage.clear()
    clickedHref = undefined
    clickedDownload = undefined
    createObjectURLMock.mockClear()
    revokeObjectURLMock.mockClear()

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clickedHref = this.href
      clickedDownload = this.download
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
    document.body.innerHTML = ''
    localStorage.clear()
  })

  describe('exportAllData', () => {
    it('6 APIを検証し、wire表現と未知フィールドを保ったバックアップを保存する', async () => {
      const fetchMock = mockExportFetch()

      await exportAllData()

      expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
        '/api/projects',
        '/api/topics',
        '/api/tasks',
        '/api/subtasks',
        '/api/tags',
        '/api/completions',
      ])
      expect(createObjectURLMock).toHaveBeenCalledTimes(1)

      const blob = createObjectURLMock.mock.calls[0]?.[0]
      expect(blob).toBeInstanceOf(Blob)
      const payload = JSON.parse(await readBlobAsText(blob as Blob)) as {
        exportedAt: string
        version: number
        data: Record<string, Array<Record<string, unknown>>>
      }

      expect(payload.version).toBe(1)
      expect(Number.isNaN(Date.parse(payload.exportedAt))).toBe(false)
      expect(payload.data.projects[0]).toEqual(PROJECT)
      expect(payload.data.topics[0]).toEqual(TOPIC)
      expect(payload.data.tasks[0]).toEqual(TASK)
      expect(payload.data.subtasks[0]).toEqual(SUBTASK)
      expect(payload.data.tags[0]).toEqual(TAG)
      expect(payload.data.task_completions[0]).toEqual(COMPLETION)
      expect(payload.data.projects[0].createdAt).toBe(1_000)
      expect(payload.data.projects[0].isArchived).toBe(1)
      expect(payload.data.tasks[0].dueDate).toBe(4_000)
      expect(payload.data.subtasks[0].isDone).toBe(0)

      expect(clickedHref).toBe('blob:tasker-backup')
      expect(clickedDownload).toMatch(/^tasker-backup-\d{4}-\d{2}-\d{2}\.json$/)
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:tasker-backup')
      expect(Number(localStorage.getItem('tasker_last_export'))).toBeGreaterThan(0)
    })

    it('成功レスポンスのDTOが不正ならダウンロードせずrejectする', async () => {
      mockExportFetch({
        '/api/tasks': jsonResponse([{ ...TASK, status: 'cancelled' }]),
      })

      await expect(exportAllData()).rejects.toThrow('APIレスポンスの形式が不正です: /api/tasks')
      expect(createObjectURLMock).not.toHaveBeenCalled()
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
      expect(localStorage.getItem('tasker_last_export')).toBeNull()
    })
  })

  describe('importAllData', () => {
    it('204レスポンスをbodyなしの成功として扱う', async () => {
      const response = noContentResponse()
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

      await expect(importAllData(backupFile())).resolves.toBeUndefined()

      expect(fetchMock).toHaveBeenCalledWith('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(IMPORT_PAYLOAD),
      })
      expect(response.json).not.toHaveBeenCalled()
    })

    it('bodyを伴う予期せぬ成功レスポンスを拒否する', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ imported: true }))

      await expect(importAllData(backupFile())).rejects.toThrow(
        'APIレスポンスの形式が不正です: /api/import'
      )
    })

    it('APIエラーレスポンスを失敗として返す', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse(
          {
            error: 'VALIDATION_ERROR',
            field: 'data.tasks.0.status',
            message: 'Invalid enum value',
          },
          400
        )
      )

      await expect(importAllData(backupFile())).rejects.toThrow('VALIDATION_ERROR')
    })
  })
})
