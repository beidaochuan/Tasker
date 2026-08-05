// @vitest-environment node

import Database from 'better-sqlite3'
import { afterAll, describe, expect, it } from 'vitest'

process.env.TASKER_DB_PATH = ':memory:'

const { db, migrateTaskIdsToIntegers } = await import('../db.js')

afterAll(() => db.close())

describe('タスクID移行', () => {
  it('旧文字列IDを作成順の連番へ変換し、すべての参照を維持する', () => {
    const legacy = new Database(':memory:')
    legacy.pragma('foreign_keys = ON')
    legacy.exec(`
      CREATE TABLE topics (id TEXT PRIMARY KEY);
      INSERT INTO topics (id) VALUES ('topic-1');

      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT,
        dueDate INTEGER,
        startDate INTEGER,
        "order" INTEGER NOT NULL DEFAULT 0,
        ganttOrder INTEGER,
        tags TEXT NOT NULL DEFAULT '[]',
        repeatRule TEXT,
        statusChangedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (topicId) REFERENCES topics(id)
      );
      CREATE TABLE subtasks (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL, title TEXT NOT NULL,
        isDone INTEGER NOT NULL, "order" INTEGER NOT NULL, createdAt INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      );
      CREATE TABLE task_completions (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL, completedAt INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      );
      CREATE TABLE task_comments (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL, body TEXT NOT NULL,
        createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      );
      CREATE TABLE task_relations (
        taskId TEXT NOT NULL, relatedTaskId TEXT NOT NULL,
        PRIMARY KEY (taskId, relatedTaskId), CHECK (taskId < relatedTaskId),
        FOREIGN KEY (taskId) REFERENCES tasks(id),
        FOREIGN KEY (relatedTaskId) REFERENCES tasks(id)
      );

      INSERT INTO tasks VALUES
        ('old-b', 'topic-1', '後のタスク', '', 'todo', 'medium', NULL, NULL, NULL, 1, NULL, '[]', NULL, 200, 200, 200),
        ('old-a', 'topic-1', '先のタスク', '', 'todo', 'medium', NULL, NULL, NULL, 0, NULL, '[]', NULL, 100, 100, 100);
      INSERT INTO subtasks VALUES ('subtask-1', 'old-b', '作業', 0, 0, 200);
      INSERT INTO task_completions VALUES ('completion-1', 'old-a', 300);
      INSERT INTO task_comments VALUES ('comment-1', 'old-b', 'コメント', 300, 300);
      INSERT INTO task_relations VALUES ('old-a', 'old-b');
    `)

    migrateTaskIdsToIntegers(legacy)

    expect(legacy.prepare('SELECT id, title FROM tasks ORDER BY id').all()).toEqual([
      { id: 1, title: '先のタスク' },
      { id: 2, title: '後のタスク' },
    ])
    expect(legacy.prepare('SELECT taskId FROM subtasks').get()).toEqual({ taskId: 2 })
    expect(legacy.prepare('SELECT taskId FROM task_completions').get()).toEqual({ taskId: 1 })
    expect(legacy.prepare('SELECT taskId FROM task_comments').get()).toEqual({ taskId: 2 })
    expect(legacy.prepare('SELECT * FROM task_relations').get()).toEqual({
      taskId: 1,
      relatedTaskId: 2,
    })
    expect(legacy.pragma('foreign_key_check')).toEqual([])

    legacy
      .prepare(
        `INSERT INTO tasks (
          topicId, title, description, status, priority, category, dueDate, startDate,
          "order", ganttOrder, tags, repeatRule, statusChangedAt, createdAt, updatedAt
        ) VALUES ('topic-1', '新規', '', 'todo', 'medium', NULL, NULL, NULL, 2, NULL, '[]', NULL, 300, 300, 300)`
      )
      .run()
    expect(legacy.prepare("SELECT id FROM tasks WHERE title = '新規'").get()).toEqual({ id: 3 })

    legacy.close()
  })
})
