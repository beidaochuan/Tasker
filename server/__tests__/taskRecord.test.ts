// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { decodeTaskTags, encodeTaskTags, taskRowToApi, type TaskRow } from '../taskRecord.js'

const TASK_ROW: TaskRow = {
  id: 'task-1',
  topicId: 'topic-1',
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  startDate: null,
  order: 0,
  ganttOrder: null,
  tags: '["tag-1","tag-2"]',
  repeatRule: null,
  statusChangedAt: 200,
  createdAt: 100,
  updatedAt: 300,
}

describe('taskRecord', () => {
  it('タグIDをJSONへ変換して復元する', () => {
    const tags = ['tag-1', '日本語タグ']

    expect(decodeTaskTags(encodeTaskTags(tags))).toEqual(tags)
  })

  it('壊れたJSONや配列ではない値を空配列として扱う', () => {
    expect(decodeTaskTags('{')).toEqual([])
    expect(decodeTaskTags('{"tag":"tag-1"}')).toEqual([])
    expect(decodeTaskTags(null)).toEqual([])
  })

  it('配列内のタグIDとして不正な値を除外する', () => {
    expect(
      decodeTaskTags(JSON.stringify(['tag-1', 42, null, '', 'x'.repeat(129), 'tag-2']))
    ).toEqual(['tag-1', 'tag-2'])
  })

  it('DB行をAPIレスポンスへ変換する', () => {
    expect(taskRowToApi(TASK_ROW)).toEqual({
      ...TASK_ROW,
      tags: ['tag-1', 'tag-2'],
      statusChangedAt: 200,
    })
  })

  it('statusChangedAtがない旧データではupdatedAtへフォールバックする', () => {
    expect(taskRowToApi({ ...TASK_ROW, statusChangedAt: null }).statusChangedAt).toBe(300)
  })
})
