import { useState } from 'react'
import { X, Plus, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTags } from '@/hooks/useTags'
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { tagRepo } from '@/repositories'
import { useFilterStore } from '@/store/filterStore'
import { useAuthStore } from '@/store/authStore'
import { unwrapResult } from '@/utils/resultUtils'

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
]

interface TagManagerProps {
  onClose: () => void
}

export function TagManager({ onClose }: TagManagerProps) {
  const tags = useTags()
  const { tagIds, setTagIds } = useFilterStore()
  const { isAuthenticated, openLoginDialog } = useAuthStore()
  const invalidateTags = useDataQueryStore((state) => state.invalidateTags)
  const invalidateProjectsWithTag = useDataQueryStore((state) => state.invalidateProjectsWithTag)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    const trimmed = name.trim()
    if (!trimmed) {
      setError('タグ名を入力してください')
      return
    }
    if (tags.some((t) => t.name === trimmed)) {
      setError('同じ名前のタグが既に存在します')
      return
    }
    try {
      unwrapResult(await tagRepo.create({ name: trimmed, color }))
      invalidateTags()
      setName('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'タグの作成に失敗しました')
    }
  }

  async function handleDelete(id: string) {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    if (!window.confirm('このタグを削除しますか？タスクへの紐付けも解除されます。')) return
    try {
      unwrapResult(await tagRepo.delete(id))
      invalidateTags()
      invalidateProjectsWithTag(id)
      // filterStore に残った孤立IDを除去
      if (tagIds.includes(id)) {
        setTagIds(tagIds.filter((x) => x !== id))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'タグの削除に失敗しました')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-manager-title"
        className="w-96 rounded-lg border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="tag-manager-title" className="flex items-center gap-2 text-sm font-semibold">
            <Tag className="h-4 w-4" />
            タグ管理
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 新規作成 */}
        <div className="mb-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="タグ名"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              disabled={!isAuthenticated}
            />
            <Button size="sm" onClick={handleCreate} disabled={!isAuthenticated}>
              <Plus className="h-3.5 w-3.5" />
              追加
            </Button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                disabled={!isAuthenticated}
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
                aria-label={`カラー ${c}`}
              />
            ))}
          </div>
        </div>

        {/* タグ一覧 */}
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {tags.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">タグがありません</p>
          )}
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/40"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="text-sm">{tag.name}</span>
              </div>
              <button
                onClick={() => handleDelete(tag.id)}
                className="rounded-md p-1 text-muted-foreground hover:text-danger"
                title="削除"
                disabled={!isAuthenticated}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
