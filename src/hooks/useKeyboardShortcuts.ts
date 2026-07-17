import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useTopics } from '@/hooks/useTasks'

export function useKeyboardShortcuts() {
  const { selectedProjectId, openNewTaskDrawer } = useUIStore()
  const { isAuthenticated, openLoginDialog } = useAuthStore()
  // project-scoped query cache をビューと共有し、同じtopics取得を重複させない。
  const topics = useTopics(selectedProjectId)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // フォーカスが input / textarea / contenteditable の場合は無視
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        if (!isAuthenticated) {
          openLoginDialog()
          return
        }
        if (!topics || topics.length === 0) return
        openNewTaskDrawer(topics[0].id)
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.getElementById('search-input') as HTMLInputElement | null
        searchInput?.focus()
        searchInput?.select()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [topics, openNewTaskDrawer, isAuthenticated, openLoginDialog])
}
