import { useEffect, lazy, Suspense } from 'react'
import './index.css'
import { AppShell } from '@/components/layout/AppShell'
import { ExportWarning } from '@/components/layout/ExportWarning'
import { useUIStore } from '@/store/uiStore'
import { useThemeStore } from '@/store/themeStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const ListView = lazy(() =>
  import('@/components/views/ListView/ListView').then((module) => ({ default: module.ListView }))
)
const KanbanView = lazy(() =>
  import('@/components/views/KanbanView/KanbanView').then((module) => ({
    default: module.KanbanView,
  }))
)
const CalendarView = lazy(() => import('@/components/views/CalendarView/CalendarView'))
const GanttView = lazy(() => import('@/components/views/GanttView/GanttView'))
const TaskDrawer = lazy(() =>
  import('@/components/task/TaskDrawer').then((module) => ({ default: module.TaskDrawer }))
)
const ProjectForm = lazy(() =>
  import('@/components/project/ProjectForm').then((module) => ({ default: module.ProjectForm }))
)
const LoginDialog = lazy(() =>
  import('@/components/auth/LoginDialog').then((module) => ({ default: module.LoginDialog }))
)

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
const VIEW_FALLBACK = (
  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
    読み込み中...
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
  useKeyboardShortcuts()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => {
    navigator.storage?.persist().catch(() => {})
  }, [])

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col overflow-hidden">
        <ExportWarning />
        <AppShell>
          <ErrorBoundary>
            <Suspense fallback={VIEW_FALLBACK}>
              <MainContent />
            </Suspense>
          </ErrorBoundary>
        </AppShell>
      </div>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <TaskDrawer />
          <ProjectForm />
          <LoginDialog />
        </Suspense>
      </ErrorBoundary>
    </ErrorBoundary>
  )
}

export default App
