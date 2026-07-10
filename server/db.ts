import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'tasker.db')

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
    id TEXT PRIMARY KEY,
    topicId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    dueDate INTEGER,
    startDate INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    ganttOrder INTEGER,
    tags TEXT NOT NULL DEFAULT '[]',
    repeatRule TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (topicId) REFERENCES topics(id)
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
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
    taskId TEXT NOT NULL,
    completedAt INTEGER NOT NULL,
    FOREIGN KEY (taskId) REFERENCES tasks(id)
  );

  CREATE INDEX IF NOT EXISTS idx_topics_projectId ON topics(projectId);
  CREATE INDEX IF NOT EXISTS idx_tasks_topicId ON tasks(topicId);
  CREATE INDEX IF NOT EXISTS idx_subtasks_taskId ON subtasks(taskId);
  CREATE INDEX IF NOT EXISTS idx_task_completions_taskId ON task_completions(taskId);
`)

// Existing databases predate the Gantt-specific manual order.
const taskColumns = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]
if (!taskColumns.some((column) => column.name === 'ganttOrder')) {
  db.exec('ALTER TABLE tasks ADD COLUMN ganttOrder INTEGER')
}
