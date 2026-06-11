import { Plus, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TopicRow } from './TopicRow'
import { useTopics } from '@/hooks/useTasks'
import { useUIStore } from '@/store/uiStore'
import { topicRepo } from '@/repositories'

export function ListView() {
  const { selectedProjectId, openNewTaskDrawer } = useUIStore()
  const topics = useTopics(selectedProjectId)

  async function handleAddTopic() {
    if (!selectedProjectId) return
    const maxOrder = topics.reduce((m, t) => Math.max(m, t.order), -1)
    await topicRepo.create({
      projectId: selectedProjectId,
      name: '新しいトピック',
      order: maxOrder + 1,
    })
  }

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FolderOpen className="h-12 w-12" />
        <p className="text-sm">左のサイドバーからプロジェクトを選択してください</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold">タスク一覧</h2>
        <Button variant="outline" size="sm" onClick={handleAddTopic}>
          <Plus className="h-3.5 w-3.5" />
          トピックを追加
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {topics.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm text-muted-foreground">まだトピックがありません</p>
            <Button variant="outline" size="sm" onClick={handleAddTopic}>
              <Plus className="h-3.5 w-3.5" />
              最初のトピックを作成
            </Button>
          </div>
        )}
        {topics.map((topic) => (
          <TopicRow key={topic.id} topic={topic} onAddTask={openNewTaskDrawer} />
        ))}
      </div>
    </div>
  )
}
