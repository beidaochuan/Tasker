import { create } from 'zustand'

export type ViewType = 'list' | 'kanban' | 'calendar' | 'gantt'

interface UIState {
  activeView: ViewType
  selectedProjectId: string | null
  selectedTaskId: string | null
  newTaskTopicId: string | null
  isTaskDrawerOpen: boolean
  isProjectFormOpen: boolean
  editingProjectId: string | null

  setActiveView: (view: ViewType) => void
  setSelectedProjectId: (id: string | null) => void
  openTaskDrawer: (taskId: string) => void
  openNewTaskDrawer: (topicId: string) => void
  closeTaskDrawer: () => void
  openProjectForm: () => void
  closeProjectForm: () => void
  openProjectEditForm: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'list',
  selectedProjectId: null,
  selectedTaskId: null,
  newTaskTopicId: null,
  isTaskDrawerOpen: false,
  isProjectFormOpen: false,
  editingProjectId: null,

  setActiveView: (view) => set({ activeView: view }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  openTaskDrawer: (taskId) =>
    set({ selectedTaskId: taskId, newTaskTopicId: null, isTaskDrawerOpen: true }),
  openNewTaskDrawer: (topicId) =>
    set({ newTaskTopicId: topicId, selectedTaskId: null, isTaskDrawerOpen: true }),
  closeTaskDrawer: () =>
    set({ isTaskDrawerOpen: false, selectedTaskId: null, newTaskTopicId: null }),
  openProjectForm: () => set({ isProjectFormOpen: true, editingProjectId: null }),
  closeProjectForm: () => set({ isProjectFormOpen: false, editingProjectId: null }),
  openProjectEditForm: (id) => set({ isProjectFormOpen: true, editingProjectId: id }),
}))
