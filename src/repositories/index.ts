import { db } from '@/db/schema'
import { ProjectRepository } from './projectRepository'
import { TopicRepository } from './topicRepository'
import { TaskRepository } from './taskRepository'
import { SubtaskRepository } from './subtaskRepository'
import { TagRepository } from './tagRepository'
import { TaskCompletionRepository } from './taskCompletionRepository'

export const projectRepo = new ProjectRepository(db)
export const topicRepo = new TopicRepository(db)
export const taskRepo = new TaskRepository(db)
export const subtaskRepo = new SubtaskRepository(db)
export const tagRepo = new TagRepository(db)
export const taskCompletionRepo = new TaskCompletionRepository(db)
