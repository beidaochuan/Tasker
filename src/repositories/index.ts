import { ApiProjectRepository } from './apiProjectRepository'
import { ApiTopicRepository } from './apiTopicRepository'
import { ApiTaskRepository } from './apiTaskRepository'
import { ApiSubtaskRepository } from './apiSubtaskRepository'
import { ApiTagRepository } from './apiTagRepository'
import { ApiTaskCompletionRepository } from './apiTaskCompletionRepository'

export const projectRepo = new ApiProjectRepository()
export const topicRepo = new ApiTopicRepository()
export const taskRepo = new ApiTaskRepository()
export const subtaskRepo = new ApiSubtaskRepository()
export const tagRepo = new ApiTagRepository()
export const taskCompletionRepo = new ApiTaskCompletionRepository()
