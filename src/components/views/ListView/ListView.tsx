import { useMemo, useState } from 'react'
import { Plus, FolderOpen, X, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TopicRow } from './TopicRow'
import { FilterPanel } from '@/components/filter/FilterPanel'
import { ListViewSkeleton } from '@/components/ui/skeleton'
import { useProjectData } from '@/hooks/useTasks'
import { useFilteredTasks } from '@/hooks/useFilteredTasks'
import { useProject } from '@/hooks/useProjects'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { topicRepo } from '@/repositories'
import { unwrapResult } from '@/utils/resultUtils'
import type { Task } from '@/types'

const EMPTY_TASKS: Task[] = []

export function ListView() {
  const { selectedProjectId, openNewTaskDrawer } = useUIStore()
  const { isAuthenticated, openLoginDialog } = useAuthStore()
  const invalidateProjectTopics = useDataQueryStore((state) => state.invalidateProjectTopics)
  const { topics, tasks, isTopicsLoading } = useProjectData(selectedProjectId)
  const filteredTasks = useFilteredTasks(tasks ?? EMPTY_TASKS)
  const tasksByTopic = useMemo(() => {
    const grouped = new Map<string, Task[]>()
    for (const task of filteredTasks) {
      const topicTasks = grouped.get(task.topicId)
      if (topicTasks) topicTasks.push(task)
      else grouped.set(task.topicId, [task])
    }
    return grouped
  }, [filteredTasks])
  const selectedProject = useProject(selectedProjectId)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [topicName, setTopicName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function openDialog() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    setTopicName('')
    setIsDialogOpen(true)
  }

  async function handleAddTopic() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    const name = topicName.trim()
    if (!selectedProjectId || !name || isSubmitting) return
    setIsSubmitting(true)
    try {
      const maxOrder = (topics ?? []).reduce((m, t) => Math.max(m, t.order), -1)
      unwrapResult(
        await topicRepo.create({ projectId: selectedProjectId, name, order: maxOrder + 1 })
      )
      invalidateProjectTopics(selectedProjectId)
      setIsDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleAddTask(topicId: string) {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    openNewTaskDrawer(topicId)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !isSubmitting) {
      e.preventDefault()
      handleAddTopic().catch(console.error)
    }
    if (e.key === 'Escape') setIsDialogOpen(false)
  }

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FolderOpen className="h-12 w-12" />
        <p className="text-sm">左のサイドバーからプロジェクトを選択してください</p>
      </div>
    )
  }

  if (isTopicsLoading || topics === undefined) {
    return <ListViewSkeleton />
  }

  const taskCount = tasks?.length ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div>
          <h2 className="text-base font-semibold leading-6">
            {selectedProject?.name ?? 'タスク一覧'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {topics.length} トピック / {taskCount} タスク
          </p>
        </div>
        {isAuthenticated ? (
          <Button variant="outline" size="sm" onClick={openDialog}>
            <Plus className="h-3.5 w-3.5" />
            トピックを追加
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={openLoginDialog}>
            <LogIn className="h-3.5 w-3.5" />
            ログインして編集
          </Button>
        )}
      </div>
      <FilterPanel />

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {topics.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm text-muted-foreground">まだトピックがありません</p>
            {isAuthenticated && (
              <Button variant="outline" size="sm" onClick={openDialog}>
                <Plus className="h-3.5 w-3.5" />
                最初のトピックを作成
              </Button>
            )}
          </div>
        )}
        <div className="space-y-2">
          {topics.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              tasks={tasksByTopic.get(topic.id) ?? EMPTY_TASKS}
              canEdit={isAuthenticated}
              onAddTask={handleAddTask}
            />
          ))}
        </div>
      </div>
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsDialogOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-topic-dialog-title"
            className="relative z-10 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="add-topic-dialog-title" className="font-semibold">
                トピックを作成
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="topic-name" className="text-sm font-medium">
                  トピック名
                </label>
                <input
                  id="topic-name"
                  autoFocus
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="トピック名"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleAddTopic().catch(console.error)}
                disabled={!topicName.trim() || isSubmitting}
              >
                作成する
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
