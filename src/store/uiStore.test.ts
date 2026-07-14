import { describe, expect, it } from 'vitest'
import { useUIStore } from './uiStore'

describe('useUIStore', () => {
  it('カンバンをデフォルトビューにする', () => {
    expect(useUIStore.getState().activeView).toBe('kanban')
  })
})
