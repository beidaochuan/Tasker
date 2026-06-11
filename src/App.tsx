import { useEffect, lazy, Suspense } from 'react'
import './index.css'
import { AppShell } from '@/components/layout/AppShell'
import { ExportWarning } from '@/components/layout/ExportWarning'
import { ListView } from '@/components/views/ListView/ListView'
import { KanbanView } from '@/components/views/KanbanView/KanbanView'
import { TaskDrawer } from '@/components/task/TaskDrawer'
import { ProjectForm } from '@/components/project/ProjectForm'
import { useUIStore } from '@/store/uiStore'
import { useThemeStore } from '@/store/themeStore'

const CalendarView = lazy(() => import('@/components/views/CalendarView/CalendarView'))
const GanttView = lazy(() => import('@/components/views/GanttView/GanttView'))

// #11: 静的 JSX として定義してレンダリングごとの生成を避ける
const CALENDAR_FALLBACK = (
  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
    カレンダーを読み込み中...
  </div>
)
const GANTT_FALLBACK = (
  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
    ガントチャートを読み込み中...
  </div>
)

function MainContent() {
  const { activeView } = useUIStore()

  switch (activeView) {
    case 'list':
      return <ListView />
    case 'kanban':
      return <KanbanView />
    case 'calendar':
      return (
        <Suspense fallback={CALENDAR_FALLBACK}>
          <CalendarView />
        </Suspense>
      )
    case 'gantt':
      return (
        <Suspense fallback={GANTT_FALLBACK}>
          <GanttView />
        </Suspense>
      )
    default:
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
          {activeView} ビューは今後実装予定です
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
