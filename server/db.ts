import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configuredDbPath = process.env.TASKER_DB_PATH
const DB_PATH =
  configuredDbPath === ':memory:'
    ? configuredDbPath
    : path.resolve(configuredDbPath ?? path.join(__dirname, '..', 'tasker.db'))

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#6366f1',
    status TEXT NOT NULL DEFAULT 'active',
    isArchived INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (projectId) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    taskId INTEGER NOT NULL,
    title TEXT NOT NULL,
    isDone INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (taskId) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1'
  );

  CREATE TABLE IF NOT EXISTS task_completions (
    id TEXT PRIMARY KEY,
    taskId INTEGER NOT NULL,
    completedAt INTEGER NOT NULL,
    FOREIGN KEY (taskId) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS task_relations (
    taskId INTEGER NOT NULL,
    relatedTaskId INTEGER NOT NULL,
    PRIMARY KEY (taskId, relatedTaskId),
    CHECK (taskId < relatedTaskId),
    FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (relatedTaskId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_comments (
    id TEXT PRIMARY KEY,
    taskId INTEGER NOT NULL,
    body TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (taskId) REFERENCES tasks(id)
  );

  CREATE INDEX IF NOT EXISTS idx_topics_projectId ON topics(projectId);
  CREATE INDEX IF NOT EXISTS idx_tasks_topicId ON tasks(topicId);
  CREATE INDEX IF NOT EXISTS idx_subtasks_taskId ON subtasks(taskId);
  CREATE INDEX IF NOT EXISTS idx_task_completions_taskId ON task_completions(taskId);
  CREATE INDEX IF NOT EXISTS idx_task_relations_relatedTaskId ON task_relations(relatedTaskId);
  CREATE INDEX IF NOT EXISTS idx_task_comments_taskId ON task_comments(taskId);
`)

// Existing databases predate the Gantt-specific manual order.
const taskColumns = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]
if (!taskColumns.some((column) => column.name === 'ganttOrder')) {
  db.exec('ALTER TABLE tasks ADD COLUMN ganttOrder INTEGER')
}

// Existing databases did not track when a task entered its current status.
if (!taskColumns.some((column) => column.name === 'statusChangedAt')) {
  db.exec('ALTER TABLE tasks ADD COLUMN statusChangedAt INTEGER')
  db.exec('UPDATE tasks SET statusChangedAt = updatedAt WHERE statusChangedAt IS NULL')
}

// Existing databases predate the ソフト/デンキ category distinction.
if (!taskColumns.some((column) => column.name === 'category')) {
  db.exec('ALTER TABLE tasks ADD COLUMN category TEXT')
}

interface LegacyTaskReferenceRow {
  taskId: string
}

function mappedTaskId(idMap: Map<string, number>, oldId: unknown): number {
  const id = idMap.get(String(oldId))
  if (id === undefined) throw new Error(`移行対象のタスクIDが見つかりません: ${String(oldId)}`)
  return id
}

/** 旧文字列IDのタスクと全参照を、作成順の数値IDへ一度だけ移行する。 */
export function migrateTaskIdsToIntegers(database: Database.Database): void {
  const columns = database.prepare('PRAGMA table_info(tasks)').all() as Array<{
    name: string
    type: string
  }>
  const idColumn = columns.find((column) => column.name === 'id')
  if (idColumn?.type.toUpperCase() === 'INTEGER') return

  database.pragma('foreign_keys = OFF')
  try {
    database.transaction(() => {
      const tasks = database
        .prepare('SELECT * FROM tasks ORDER BY createdAt ASC, id ASC')
        .all() as Array<Record<string, unknown> & { id: string }>
      const subtasks = database.prepare('SELECT * FROM subtasks').all() as Array<
        Record<string, unknown> & LegacyTaskReferenceRow
      >
      const completions = database.prepare('SELECT * FROM task_completions').all() as Array<
        Record<string, unknown> & LegacyTaskReferenceRow
      >
      const comments = database.prepare('SELECT * FROM task_comments').all() as Array<
        Record<string, unknown> & LegacyTaskReferenceRow
      >
      const relations = database.prepare('SELECT * FROM task_relations').all() as Array<{
        taskId: string
        relatedTaskId: string
      }>

      database.exec(`
        ALTER TABLE task_relations RENAME TO task_relations_legacy;
        ALTER TABLE task_completions RENAME TO task_completions_legacy;
        ALTER TABLE task_comments RENAME TO task_comments_legacy;
        ALTER TABLE subtasks RENAME TO subtasks_legacy;
        ALTER TABLE tasks RENAME TO tasks_legacy;

        CREATE TABLE tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
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
          id TEXT PRIMARY KEY,
          taskId INTEGER NOT NULL,
          title TEXT NOT NULL,
          isDone INTEGER NOT NULL DEFAULT 0,
          "order" INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (taskId) REFERENCES tasks(id)
        );

        CREATE TABLE task_completions (
          id TEXT PRIMARY KEY,
          taskId INTEGER NOT NULL,
          completedAt INTEGER NOT NULL,
          FOREIGN KEY (taskId) REFERENCES tasks(id)
        );

        CREATE TABLE task_relations (
          taskId INTEGER NOT NULL,
          relatedTaskId INTEGER NOT NULL,
          PRIMARY KEY (taskId, relatedTaskId),
          CHECK (taskId < relatedTaskId),
          FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (relatedTaskId) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE task_comments (
          id TEXT PRIMARY KEY,
          taskId INTEGER NOT NULL,
          body TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          FOREIGN KEY (taskId) REFERENCES tasks(id)
        );
      `)

      const insertTask = database.prepare(
        'INSERT INTO tasks (topicId, title, description, status, priority, category, dueDate, startDate, "order", ganttOrder, tags, repeatRule, statusChangedAt, createdAt, updatedAt) VALUES (@topicId, @title, @description, @status, @priority, @category, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @statusChangedAt, @createdAt, @updatedAt)'
      )
      const idMap = new Map<string, number>()
      for (const task of tasks) {
        const result = insertTask.run(task)
        idMap.set(task.id, Number(result.lastInsertRowid))
      }

      const insertSubtask = database.prepare(
        'INSERT INTO subtasks (id, taskId, title, isDone, "order", createdAt) VALUES (@id, @taskId, @title, @isDone, @order, @createdAt)'
      )
      for (const row of subtasks) {
        insertSubtask.run({ ...row, taskId: mappedTaskId(idMap, row.taskId) })
      }

      const insertCompletion = database.prepare(
        'INSERT INTO task_completions (id, taskId, completedAt) VALUES (@id, @taskId, @completedAt)'
      )
      for (const row of completions) {
        insertCompletion.run({ ...row, taskId: mappedTaskId(idMap, row.taskId) })
      }

      const insertComment = database.prepare(
        'INSERT INTO task_comments (id, taskId, body, createdAt, updatedAt) VALUES (@id, @taskId, @body, @createdAt, @updatedAt)'
      )
      for (const row of comments) {
        insertComment.run({ ...row, taskId: mappedTaskId(idMap, row.taskId) })
      }

      const insertRelation = database.prepare(
        'INSERT INTO task_relations (taskId, relatedTaskId) VALUES (?, ?)'
      )
      for (const row of relations) {
        const pair = [mappedTaskId(idMap, row.taskId), mappedTaskId(idMap, row.relatedTaskId)].sort(
          (a, b) => a - b
        )
        insertRelation.run(pair[0], pair[1])
      }

      database.exec(`
        DROP TABLE task_relations_legacy;
        DROP TABLE task_completions_legacy;
        DROP TABLE task_comments_legacy;
        DROP TABLE subtasks_legacy;
        DROP TABLE tasks_legacy;

        CREATE INDEX idx_tasks_topicId ON tasks(topicId);
        CREATE INDEX idx_subtasks_taskId ON subtasks(taskId);
        CREATE INDEX idx_task_completions_taskId ON task_completions(taskId);
        CREATE INDEX idx_task_relations_relatedTaskId ON task_relations(relatedTaskId);
        CREATE INDEX idx_task_comments_taskId ON task_comments(taskId);
      `)
    })()
  } finally {
    database.pragma('foreign_keys = ON')
  }

  const violations = database.pragma('foreign_key_check') as unknown[]
  if (violations.length > 0) throw new Error('タスクID移行後の外部キー検証に失敗しました')
}

migrateTaskIdsToIntegers(db)
