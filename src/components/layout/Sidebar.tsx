import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Plus,
  FolderOpen,
  Moon,
  Sun,
  Tag,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { useProjects } from '@/hooks/useProjects'
import { useUIStore } from '@/store/uiStore'
import { useThemeStore } from '@/store/themeStore'
import { TagManager } from '@/components/task/TagManager'
import { exportAllData, importAllData } from '@/utils/exportUtils'

type DialogState =
  | { type: 'none' }
  | { type: 'confirm'; file: File }
  | { type: 'success' }
  | { type: 'error'; message: string }

export function Sidebar() {
  const projects = useProjects()
  const { selectedProjectId, setSelectedProjectId, openProjectForm } = useUIStore()
  const { isDark, toggleDark } = useThemeStore()
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false)
  const [dialogState, setDialogState] = useState<DialogState>({ type: 'none' })
  const importInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setDialogState({ type: 'confirm', file })
  }

  async function handleConfirmImport() {
    if (dialogState.type !== 'confirm') return
    const { file } = dialogState
    setDialogState({ type: 'none' })
    try {
      await importAllData(file)
      setDialogState({ type: 'success' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'インポートに失敗しました'
      setDialogState({ type: 'error', message })
    }
  }

  const isDialogOpen = dialogState.type !== 'none'

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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => exportAllData()}
          title="JSONエクスポート"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => importInputRef.current?.click()}
          title="JSONインポート"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {isTagManagerOpen && <TagManager onClose={() => setIsTagManagerOpen(false)} />}

      {/* インポート確認 / 結果ダイアログ */}
      <Dialog.Root
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogState({ type: 'none' })
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none">
            {dialogState.type === 'confirm' && (
              <>
                <div className="mb-4 flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <Dialog.Title className="text-sm font-semibold">インポートの確認</Dialog.Title>
                    <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                      現在のデータをすべて置き換えます。この操作は元に戻せません。
                    </Dialog.Description>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogState({ type: 'none' })}
                  >
                    キャンセル
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleConfirmImport}>
                    インポート
                  </Button>
                </div>
              </>
            )}
            {dialogState.type === 'success' && (
              <>
                <div className="mb-4 flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  <div>
                    <Dialog.Title className="text-sm font-semibold">インポート完了</Dialog.Title>
                    <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                      データのインポートが完了しました。
                    </Dialog.Description>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setDialogState({ type: 'none' })}>
                    閉じる
                  </Button>
                </div>
              </>
            )}
            {dialogState.type === 'error' && (
              <>
                <div className="mb-4 flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <Dialog.Title className="text-sm font-semibold">インポートエラー</Dialog.Title>
                    <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                      {dialogState.message}
                    </Dialog.Description>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogState({ type: 'none' })}
                  >
                    閉じる
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
  )
}
