import { useMemo, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFilterStore } from '@/store/filterStore'
import { useTags } from '@/hooks/useTags'
import { PRIORITY_LABELS, STATUS_LABELS } from '@/utils/taskPresentation'
import type { TaskStatus, Priority } from '@/types'

const ALL_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled']
const ALL_PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

export function FilterPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const {
    searchText,
    statuses,
    priorities,
    tagIds,
    dueDateFrom,
    dueDateTo,
    setSearchText,
    setStatuses,
    setPriorities,
    setTagIds,
    resetFilters,
  } = useFilterStore()
  const tags = useTags()

  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  const activeCount =
    (searchText ? 1 : 0) +
    (statuses.length > 0 ? 1 : 0) +
    (priorities.length > 0 ? 1 : 0) +
    (tagIds.length > 0 ? 1 : 0) +
    (dueDateFrom !== null || dueDateTo !== null ? 1 : 0)

  function toggleStatus(s: TaskStatus) {
    setStatuses(statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s])
  }

  function togglePriority(p: Priority) {
    setPriorities(priorities.includes(p) ? priorities.filter((x) => x !== p) : [...priorities, p])
  }

  function toggleTag(id: string) {
    setTagIds(tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id])
  }

  return (
    <div className="border-b border-border bg-card">
      {/* 検索バー + フィルタトグル */}
      <div className="flex items-center gap-2 px-5 py-3">
        <input
          id="search-input"
          type="search"
          placeholder="タスクを検索... (/)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <Button
          variant={isOpen ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setIsOpen((v) => !v)}
          className="relative shrink-0"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          フィルタ
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} title="フィルタをリセット">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* 展開パネル */}
      {isOpen && (
        <div className="space-y-3 px-5 pb-4">
          {/* ステータス */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">ステータス</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    statuses.includes(s)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* 優先度 */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">優先度</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    priorities.includes(p)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* タグ */}
          {tags.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">タグ</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      tagIds.includes(tag.id)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                    )}
                    style={
                      tagIds.includes(tag.id) ? {} : { borderColor: tag.color, color: tag.color }
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* アクティブフィルタのサマリバッジ */}
      {!isOpen && activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-3">
          {searchText && (
            <Badge variant="secondary" className="gap-1 text-xs">
              「{searchText}」
              <button onClick={() => setSearchText('')} className="ml-0.5 hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {statuses.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1 text-xs">
              {STATUS_LABELS[s]}
              <button onClick={() => toggleStatus(s)} className="ml-0.5 hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {priorities.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1 text-xs">
              {PRIORITY_LABELS[p]}
              <button onClick={() => togglePriority(p)} className="ml-0.5 hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {tagIds.map((id) => {
            const tag = tagMap.get(id)
            if (!tag) return null
            return (
              <Badge key={id} variant="secondary" className="gap-1 text-xs">
                {tag.name}
                <button onClick={() => toggleTag(id)} className="ml-0.5 hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
