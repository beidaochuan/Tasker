import type { FC, SVGProps } from 'react'
import { LayoutList, KanbanSquare, Calendar, GanttChartSquare } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUIStore, type ViewType } from '@/store/uiStore'

const TABS: { value: ViewType; label: string; Icon: FC<SVGProps<SVGSVGElement>> }[] = [
  { value: 'list', label: 'リスト', Icon: LayoutList },
  { value: 'gantt', label: 'ガント', Icon: GanttChartSquare },
  { value: 'kanban', label: 'カンバン', Icon: KanbanSquare },
  { value: 'calendar', label: 'カレンダー', Icon: Calendar },
]

export function ViewTabs() {
  const { activeView, setActiveView } = useUIStore()

  return (
    <div className="flex shrink-0 border-b border-border bg-card px-3">
      {TABS.map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => setActiveView(value)}
          className={cn(
            'flex h-11 items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition-colors',
            activeView === value
              ? 'border-b-2 border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
