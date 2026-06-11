import { useEffect } from 'react'
import './index.css'
import { AppShell } from '@/components/layout/AppShell'
import { ExportWarning } from '@/components/layout/ExportWarning'
import { ListView } from '@/components/views/ListView/ListView'
import { TaskDrawer } from '@/components/task/TaskDrawer'
import { ProjectForm } from '@/components/project/ProjectForm'
import { useUIStore } from '@/store/uiStore'
import { useThemeStore } from '@/store/themeStore'

function MainContent() {
  const { activeView } = useUIStore()

  switch (activeView) {
    case 'list':
      return <ListView />
    default:
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
          {activeView} ビューは Phase 2 以降で実装予定です
        </div>
      )
  }
}

function App() {
  const { isDark } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => {
    navigator.storage?.persist().catch(() => {})
  }, [])

  return (
    <>
      <ExportWarning />
      <AppShell>
        <MainContent />
      </AppShell>
      <TaskDrawer />
      <ProjectForm />
    </>
  )
}

export default App
