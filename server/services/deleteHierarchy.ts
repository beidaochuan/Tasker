import type Database from 'better-sqlite3'

export function deleteTaskHierarchy(database: Database.Database, taskId: string): void {
  database.transaction(() => {
    database.prepare('DELETE FROM subtasks WHERE taskId = ?').run(taskId)
    database.prepare('DELETE FROM task_completions WHERE taskId = ?').run(taskId)
    database.prepare('DELETE FROM tasks WHERE id = ?').run(taskId)
  })()
}

export function deleteTopicHierarchy(database: Database.Database, topicId: string): void {
  database.transaction(() => {
    database
      .prepare('DELETE FROM subtasks WHERE taskId IN (SELECT id FROM tasks WHERE topicId = ?)')
      .run(topicId)
    database
      .prepare(
        'DELETE FROM task_completions WHERE taskId IN (SELECT id FROM tasks WHERE topicId = ?)'
      )
      .run(topicId)
    database.prepare('DELETE FROM tasks WHERE topicId = ?').run(topicId)
    database.prepare('DELETE FROM topics WHERE id = ?').run(topicId)
  })()
}

export function deleteProjectHierarchy(database: Database.Database, projectId: string): void {
  database.transaction(() => {
    database
      .prepare(
        `DELETE FROM subtasks
         WHERE taskId IN (
           SELECT tasks.id
           FROM tasks
           INNER JOIN topics ON tasks.topicId = topics.id
           WHERE topics.projectId = ?
         )`
      )
      .run(projectId)
    database
      .prepare(
        `DELETE FROM task_completions
         WHERE taskId IN (
           SELECT tasks.id
           FROM tasks
           INNER JOIN topics ON tasks.topicId = topics.id
           WHERE topics.projectId = ?
         )`
      )
      .run(projectId)
    database
      .prepare('DELETE FROM tasks WHERE topicId IN (SELECT id FROM topics WHERE projectId = ?)')
      .run(projectId)
    database.prepare('DELETE FROM topics WHERE projectId = ?').run(projectId)
    database.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
  })()
}
