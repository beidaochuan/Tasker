// @vitest-environment node

import type { AddressInfo } from 'node:net'
import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ServerConfig } from '../config.js'

process.env.TASKER_DB_PATH = ':memory:'

const TEST_USERNAME = 'api-test-admin'
const TEST_PASSWORD = 'api-test-password'
const TEST_CONFIG: ServerConfig = {
  port: 0,
  host: '127.0.0.1',
  corsOrigins: [],
  auth: {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    sessionTtlMs: 8 * 60 * 60 * 1000,
    maxSessions: 8,
    cookieSecure: false,
    loginWindowMs: 15 * 60 * 1000,
    maxLoginAttempts: 5,
  },
}

const { createApp } = await import('../app.js')
const { db } = await import('../db.js')

let server: Server
let baseUrl: string
let sessionCookie: string
let csrfToken: string

async function rawRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const body = response.status === 204 ? null : await response.json()
  return { response, body }
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Cookie', sessionCookie)
  const method = (init.method ?? 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken)
  }
  return rawRequest(path, { ...init, headers })
}

async function post(path: string, body: unknown) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  server = createServer(createApp({ config: TEST_CONFIG }))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

beforeEach(async () => {
  db.transaction(() => {
    db.prepare('DELETE FROM task_completions').run()
    db.prepare('DELETE FROM subtasks').run()
    db.prepare('DELETE FROM tasks').run()
    db.prepare('DELETE FROM topics').run()
    db.prepare('DELETE FROM projects').run()
    db.prepare('DELETE FROM tags').run()
  })()

  const login = await rawRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
  })
  if (login.response.status !== 200) throw new Error('APIテスト用ログインに失敗しました')
  const setCookie = login.response.headers.get('set-cookie')
  if (!setCookie) throw new Error('APIテスト用セッションCookieがありません')
  sessionCookie = setCookie.split(';', 1)[0]
  csrfToken = login.body.csrfToken as string
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  db.close()
})

describe('Tasker API', () => {
  it('同じタスク内の作業リストをまとめて並び替える', async () => {
    const project = await post('/api/projects', { name: 'Project' })
    const topic = await post('/api/topics', { projectId: project.body.id, name: 'Topic' })
    const task = await post('/api/tasks', { topicId: topic.body.id, title: 'Task' })
    const first = await post('/api/subtasks', {
      taskId: task.body.id,
      title: 'First',
      order: 0,
    })
    const second = await post('/api/subtasks', {
      taskId: task.body.id,
      title: 'Second',
      order: 1,
    })

    const reordered = await request('/api/subtasks/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: second.body.id, order: 0 },
          { id: first.body.id, order: 1 },
        ],
      }),
    })

    expect(reordered.response.status).toBe(204)
    expect(
      (await request(`/api/subtasks?taskId=${task.body.id}`)).body.map(
        (item: { id: string }) => item.id
      )
    ).toEqual([second.body.id, first.body.id])
  })

  it('不正なタスク状態を400で拒否し、DBへ保存しない', async () => {
    const project = await post('/api/projects', { name: 'Project' })
    const topic = await post('/api/topics', {
      projectId: project.body.id,
      name: 'Topic',
    })

    const invalid = await post('/api/tasks', {
      topicId: topic.body.id,
      title: 'Task',
      status: 'invalid-status',
    })

    expect(invalid.response.status).toBe(400)
    expect(invalid.body.error).toBe('VALIDATION_ERROR')
    expect(invalid.body.field).toBe('status')

    const tasks = await request('/api/tasks')
    expect(tasks.body).toEqual([])
  })

  it('JavaScript Dateの範囲外となるtimestampを400で拒否する', async () => {
    const project = await post('/api/projects', { name: 'Project' })
    const topic = await post('/api/topics', {
      projectId: project.body.id,
      name: 'Topic',
    })

    const invalid = await post('/api/tasks', {
      topicId: topic.body.id,
      title: 'Task',
      dueDate: 8_640_000_000_000_001,
    })

    expect(invalid.response.status).toBe(400)
    expect(invalid.body.error).toBe('VALIDATION_ERROR')
    expect(invalid.body.field).toBe('dueDate')
    expect((await request('/api/tasks')).body).toEqual([])
  })

  it('空のPATCHと不正な型を拒否し、既存データを保持する', async () => {
    const project = await post('/api/projects', { name: 'Original' })

    const emptyPatch = await request(`/api/projects/${project.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const invalidPatch = await request(`/api/projects/${project.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    })

    expect(emptyPatch.response.status).toBe(400)
    expect(invalidPatch.response.status).toBe(400)
    const stored = await request(`/api/projects/${project.body.id}`)
    expect(stored.body.name).toBe('Original')
  })

  it('DB内のタグJSONが壊れていてもタスクを安全に返す', async () => {
    const project = await post('/api/projects', { name: 'Project' })
    const topic = await post('/api/topics', {
      projectId: project.body.id,
      name: 'Topic',
    })
    const task = await post('/api/tasks', {
      topicId: topic.body.id,
      title: 'Task',
      tags: ['tag-1'],
    })
    db.prepare('UPDATE tasks SET tags = ? WHERE id = ?').run('{', task.body.id)

    const stored = await request(`/api/tasks/${task.body.id}`)

    expect(stored.response.status).toBe(200)
    expect(stored.body.tags).toEqual([])
  })

  it('外部キー違反と壊れたJSONをJSON形式の400で返す', async () => {
    const missingParent = await post('/api/topics', {
      projectId: 'missing-project',
      name: 'Topic',
    })
    const malformedJson = await request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })

    expect(missingParent.response.status).toBe(400)
    expect(missingParent.body).toEqual({ error: 'VALIDATION_ERROR' })
    expect(malformedJson.response.status).toBe(400)
    expect(malformedJson.body.error).toBe('VALIDATION_ERROR')
  })

  it('不正なインポートを拒否し、既存データを削除しない', async () => {
    const project = await post('/api/projects', { name: 'Keep me' })

    const imported = await post('/api/import', {
      version: 1,
      data: {
        projects: [],
        topics: [],
        tasks: [
          {
            id: 'task-1',
            topicId: 'topic-1',
            title: 'Broken',
            description: '',
            status: 'broken',
            priority: 'medium',
            dueDate: null,
            startDate: null,
            order: 0,
            tags: [],
            repeatRule: null,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        subtasks: [],
        tags: [],
        task_completions: [],
      },
    })

    expect(imported.response.status).toBe(400)
    const stored = await request(`/api/projects/${project.body.id}`)
    expect(stored.response.status).toBe(200)
    expect(stored.body.name).toBe('Keep me')
  })

  it('インポート途中の外部キー違反をロールバックする', async () => {
    const project = await post('/api/projects', { name: 'Keep me' })

    const imported = await post('/api/import', {
      version: 1,
      data: {
        projects: [
          {
            id: 'replacement-project',
            name: 'Replacement',
            description: '',
            color: '#6366f1',
            status: 'active',
            isArchived: 0,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        topics: [
          {
            id: 'orphan-topic',
            projectId: 'missing-project',
            name: 'Orphan',
            order: 0,
            createdAt: 1,
          },
        ],
        tasks: [],
        subtasks: [],
        tags: [],
        task_completions: [],
      },
    })

    expect(imported.response.status).toBe(400)
    expect((await request(`/api/projects/${project.body.id}`)).body.name).toBe('Keep me')
    expect((await request('/api/projects/replacement-project')).response.status).toBe(404)
  })

  it('対応していないバックアップバージョンを拒否する', async () => {
    const imported = await post('/api/import', {
      version: 2,
      data: {
        projects: [],
        topics: [],
        tasks: [],
        subtasks: [],
        tags: [],
        task_completions: [],
      },
    })

    expect(imported.response.status).toBe(400)
    expect(imported.body.field).toBe('version')
  })

  it('旧バックアップのnull statusChangedAtをupdatedAtで補完する', async () => {
    const updatedAt = 2_000
    const imported = await post('/api/import', {
      version: 1,
      data: {
        projects: [
          {
            id: 'project-1',
            name: 'Project',
            description: '',
            color: '#6366f1',
            status: 'active',
            isArchived: 0,
            createdAt: 1_000,
            updatedAt,
          },
        ],
        topics: [
          {
            id: 'topic-1',
            projectId: 'project-1',
            name: 'Topic',
            order: 0,
            createdAt: 1_000,
          },
        ],
        tasks: [
          {
            id: 'task-1',
            topicId: 'topic-1',
            title: 'Task',
            description: '',
            status: 'todo',
            priority: 'medium',
            dueDate: null,
            startDate: null,
            order: 0,
            tags: [],
            repeatRule: null,
            statusChangedAt: null,
            createdAt: 1_000,
            updatedAt,
          },
        ],
        subtasks: [],
        tags: [],
        task_completions: [],
      },
    })

    expect(imported.response.status).toBe(204)
    expect((await request('/api/tasks/task-1')).body.statusChangedAt).toBe(updatedAt)
  })

  it('プロジェクト削除を関連データ全体へ反映する', async () => {
    const project = await post('/api/projects', { name: 'Project' })
    const topic = await post('/api/topics', {
      projectId: project.body.id,
      name: 'Topic',
    })
    const task = await post('/api/tasks', {
      topicId: topic.body.id,
      title: 'Task',
    })
    await post('/api/subtasks', { taskId: task.body.id, title: 'Subtask' })
    await post('/api/completions', { taskId: task.body.id })

    const deleted = await request(`/api/projects/${project.body.id}`, { method: 'DELETE' })

    expect(deleted.response.status).toBe(204)
    expect((await request('/api/projects')).body).toEqual([])
    expect((await request('/api/topics')).body).toEqual([])
    expect((await request('/api/tasks')).body).toEqual([])
    expect((await request('/api/subtasks')).body).toEqual([])
    expect((await request('/api/completions')).body).toEqual([])
  })

  it('トピック削除を対象トピックのタスク・サブタスク・完了履歴へ反映する', async () => {
    const project = await post('/api/projects', { name: 'Project' })
    const targetTopic = await post('/api/topics', {
      projectId: project.body.id,
      name: 'Target topic',
    })
    const siblingTopic = await post('/api/topics', {
      projectId: project.body.id,
      name: 'Sibling topic',
    })
    const targetTask = await post('/api/tasks', {
      topicId: targetTopic.body.id,
      title: 'Target task',
    })
    const siblingTask = await post('/api/tasks', {
      topicId: siblingTopic.body.id,
      title: 'Sibling task',
    })
    await post('/api/subtasks', { taskId: targetTask.body.id, title: 'Target subtask' })
    const siblingSubtask = await post('/api/subtasks', {
      taskId: siblingTask.body.id,
      title: 'Sibling subtask',
    })
    await post('/api/completions', { taskId: targetTask.body.id })
    const siblingCompletion = await post('/api/completions', { taskId: siblingTask.body.id })

    const deleted = await request(`/api/topics/${targetTopic.body.id}`, { method: 'DELETE' })
    const deletedAgain = await request(`/api/topics/${targetTopic.body.id}`, {
      method: 'DELETE',
    })

    expect(deleted.response.status).toBe(204)
    expect(deletedAgain.response.status).toBe(204)
    expect((await request(`/api/topics/${targetTopic.body.id}`)).response.status).toBe(404)
    expect((await request(`/api/projects/${project.body.id}`)).response.status).toBe(200)
    expect((await request('/api/tasks')).body.map((task: { id: string }) => task.id)).toEqual([
      siblingTask.body.id,
    ])
    expect((await request('/api/subtasks')).body.map((item: { id: string }) => item.id)).toEqual([
      siblingSubtask.body.id,
    ])
    expect((await request('/api/completions')).body.map((item: { id: string }) => item.id)).toEqual(
      [siblingCompletion.body.id]
    )
  })

  it('タスク削除を対象タスクのサブタスク・完了履歴へ反映する', async () => {
    const project = await post('/api/projects', { name: 'Project' })
    const topic = await post('/api/topics', {
      projectId: project.body.id,
      name: 'Topic',
    })
    const targetTask = await post('/api/tasks', {
      topicId: topic.body.id,
      title: 'Target task',
    })
    const siblingTask = await post('/api/tasks', {
      topicId: topic.body.id,
      title: 'Sibling task',
    })
    await post('/api/subtasks', { taskId: targetTask.body.id, title: 'Target subtask' })
    const siblingSubtask = await post('/api/subtasks', {
      taskId: siblingTask.body.id,
      title: 'Sibling subtask',
    })
    await post('/api/completions', { taskId: targetTask.body.id })
    const siblingCompletion = await post('/api/completions', { taskId: siblingTask.body.id })

    const deleted = await request(`/api/tasks/${targetTask.body.id}`, { method: 'DELETE' })
    const deletedAgain = await request(`/api/tasks/${targetTask.body.id}`, { method: 'DELETE' })

    expect(deleted.response.status).toBe(204)
    expect(deletedAgain.response.status).toBe(204)
    expect((await request(`/api/tasks/${targetTask.body.id}`)).response.status).toBe(404)
    expect((await request(`/api/topics/${topic.body.id}`)).response.status).toBe(200)
    expect((await request('/api/tasks')).body.map((task: { id: string }) => task.id)).toEqual([
      siblingTask.body.id,
    ])
    expect((await request('/api/subtasks')).body.map((item: { id: string }) => item.id)).toEqual([
      siblingSubtask.body.id,
    ])
    expect((await request('/api/completions')).body.map((item: { id: string }) => item.id)).toEqual(
      [siblingCompletion.body.id]
    )
  })
})
