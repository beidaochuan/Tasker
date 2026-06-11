import { useState } from 'react'
import { Plus, FolderOpen, Moon, Sun, Tag } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { useProjects } from '@/hooks/useProjects'
import { useUIStore } from '@/store/uiStore'
import { useThemeStore } from '@/store/themeStore'
import { TagManager } from '@/components/task/TagManager'

export function Sidebar() {
  const projects = useProjects()
  const { selectedProjectId, setSelectedProjectId, openProjectForm } = useUIStore()
  const { isDark, toggleDark } = useThemeStore()
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false)

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-semibold text-muted-foreground">プロジェクト</span>
        <Button variant="ghost" size="icon" onClick={openProjectForm} title="新規プロジェクト">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => setSelectedProjectId(project.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              selectedProjectId === project.id
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-accent/50'
            )}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate">{project.name}</span>
          </button>
        ))}

        {projects.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">プロジェクトがありません</p>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-1 border-t border-border p-3">
        <Button variant="ghost" size="icon" onClick={toggleDark} title="テーマ切替">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsTagManagerOpen(true)}
          title="タグ管理"
        >
          <Tag className="h-4 w-4" />
        </Button>
      </div>

      {isTagManagerOpen && <TagManager onClose={() => setIsTagManagerOpen(false)} />}
    </aside>
  )
}
