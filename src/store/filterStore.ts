import { create } from 'zustand'
import type { TaskStatus, Priority } from '@/types'

interface FilterState {
  searchText: string
  statuses: TaskStatus[]
  priorities: Priority[]
  tagIds: string[]
  dueDateFrom: Date | null
  dueDateTo: Date | null

  setSearchText: (text: string) => void
  setStatuses: (statuses: TaskStatus[]) => void
  setPriorities: (priorities: Priority[]) => void
  setTagIds: (tagIds: string[]) => void
  setDueDateRange: (from: Date | null, to: Date | null) => void
  resetFilters: () => void
}

const initialFilter = {
  searchText: '',
  statuses: [] as TaskStatus[],
  priorities: [] as Priority[],
  tagIds: [] as string[],
  dueDateFrom: null,
  dueDateTo: null,
}

export const useFilterStore = create<FilterState>((set) => ({
  ...initialFilter,

  setSearchText: (text) => set({ searchText: text }),
  setStatuses: (statuses) => set({ statuses }),
  setPriorities: (priorities) => set({ priorities }),
  setTagIds: (tagIds) => set({ tagIds }),
  setDueDateRange: (from, to) => set({ dueDateFrom: from, dueDateTo: to }),
  resetFilters: () => set(initialFilter),
}))
