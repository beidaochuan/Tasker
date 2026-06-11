import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { TaskRow } from '@/components/task/TaskRow'
import { useTasksByTopic } from '@/hooks/useTasks'
import type { Topic } from '@/types'

interface TopicRowProps {
  topic: Topic
  onAddTask: (topicId: string) => void
}

export function TopicRow({ topic, onAddTask }: TopicRowProps) {
  const [isOpen, setIsOpen] = useState(true)
  const tasks = useTasksByTopic(topic.id)

  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent/40"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span>{topic.name}</span>
          <span className="ml-1 text-xs text-muted-foreground">({tasks.length})</span>
        </button>
        <button
          onClick={() => onAddTask(topic.id)}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          title="タスクを追加"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && (
        <div className={cn('ml-4 space-y-0.5', tasks.length === 0 && 'py-1')}>
          {tasks.length === 0 && (
            <p className="px-5 py-2 text-xs text-muted-foreground">タスクがありません</p>
          )}
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
