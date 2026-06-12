import { useState } from 'react'
import { Plus, FolderOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TopicRow } from './TopicRow'
import { FilterPanel } from '@/components/filter/FilterPanel'
import { ListViewSkeleton } from '@/components/ui/skeleton'
import { useTopics } from '@/hooks/useTasks'
import { useUIStore } from '@/store/uiStore'
import { topicRepo } from '@/repositories'

export function ListView() {
  const { selectedProjectId, openNewTaskDrawer } = useUIStore()
  const topics = useTopics(selectedProjectId)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [topicName, setTopicName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function openDialog() {
    setTopicName('')
    setIsDialogOpen(true)
  }

  async function handleAddTopic() {
    const name = topicName.trim()
    if (!selectedProjectId || !name || isSubmitting) return
    setIsSubmitting(true)
    try {
      const maxOrder = (topics ?? []).reduce((m, t) => Math.max(m, t.order), -1)
      await topicRepo.create({ projectId: selectedProjectId, name, order: maxOrder + 1 })
      setIsDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
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

  if (topics === undefined) {
    return <ListViewSkeleton />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold">タスク一覧</h2>
        <Button variant="outline" size="sm" onClick={openDialog}>
          <Plus className="h-3.5 w-3.5" />
          トピックを追加
        </Button>
      </div>
      <FilterPanel />

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {topics.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm text-muted-foreground">まだトピックがありません</p>
            <Button variant="outline" size="sm" onClick={openDialog}>
              <Plus className="h-3.5 w-3.5" />
              最初のトピックを作成
            </Button>
          </div>
        )}
        {topics.map((topic) => (
          <TopicRow key={topic.id} topic={topic} onAddTask={openNewTaskDrawer} />
        ))}
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
