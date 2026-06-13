import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { TaskerDB } from '@/db/schema'
import { TagRepository } from '../tagRepository'

let db: TaskerDB
let tagRepo: TagRepository

beforeEach(() => {
  db = new TaskerDB(new IDBFactory())
  tagRepo = new TagRepository(db)
})

describe('TagRepository', () => {
  describe('delete', () => {
    it('タグ削除時にタスクの tags 配列からも削除する', async () => {
      await db.tags.add({ id: 'tag-1', name: 'Tag', color: '#000' })
      await db.tasks.add({
        id: 'task-1',
        topicId: 'topic-1',
        title: 'Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        startDate: null,
        order: 0,
        tags: ['tag-1', 'tag-2'],
        repeatRule: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const result = await tagRepo.delete('tag-1')

      expect(result.ok).toBe(true)
      const task = await db.tasks.get('task-1')
      expect(task?.tags).toEqual(['tag-2'])
    })
  })
})
