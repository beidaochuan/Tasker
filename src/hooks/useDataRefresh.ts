import { create } from 'zustand'

interface RefreshState {
  counter: number
  refresh: () => void
}

export const useRefreshStore = create<RefreshState>((set) => ({
  counter: 0,
  refresh: () => set((s) => ({ counter: (s.counter + 1) % 1_000_000 })),
}))
