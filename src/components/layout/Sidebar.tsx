import { useEffect, useState, useRef } from 'react'
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
  Trash2,
  Info,
  Pencil,
  LogIn,
  LogOut,
  Eye,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { useProjects } from '@/hooks/useProjects'
import { useUIStore } from '@/store/uiStore'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { TagManager } from '@/components/task/TagManager'
import { exportAllData, importAllData } from '@/utils/exportUtils'
import { useRefreshStore } from '@/hooks/useDataRefresh'
import { projectRepo } from '@/repositories'
import { unwrapResult } from '@/utils/resultUtils'
import { LicensesDialog } from './LicensesDialog'

type DialogState =
  | { type: 'none' }
  | { type: 'confirm'; file: File }
  | { type: 'success' }
  | { type: 'error'; message: string }
  | { type: 'deleteConfirm'; projectId: string; projectName: string }

export function Sidebar() {
  const projects = useProjects()
  const { selectedProjectId, setSelectedProjectId, openProjectForm, openProjectEditForm } =
    useUIStore()
  const { isDark, toggleDark } = useThemeStore()
  const { isAuthenticated, openLoginDialog, logout } = useAuthStore()
  const refresh = useRefreshStore((s) => s.refresh)
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false)
  const [isLicensesOpen, setIsLicensesOpen] = useState(false)
  const [dialogState, setDialogState] = useState<DialogState>({ type: 'none' })
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (
      projects.length > 0 &&
      (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId))
    ) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId, setSelectedProjectId])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setDialogState({ type: 'confirm', file })
  }

  async function handleDeleteProject() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    if (dialogState.type !== 'deleteConfirm') return
    const { projectId } = dialogState
    setDialogState({ type: 'none' })
    try {
      unwrapResult(await projectRepo.delete(projectId))
      refresh()
      if (selectedProjectId === projectId) setSelectedProjectId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プロジェクトの削除に失敗しました'
      setDialogState({ type: 'error', message })
    }
  }

  async function handleConfirmImport() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    if (dialogState.type !== 'confirm') return
    const { file } = dialogState
    setDialogState({ type: 'none' })
    try {
      await importAllData(file)
      refresh()
      setDialogState({ type: 'success' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'インポートに失敗しました'
      setDialogState({ type: 'error', message })
    }
  }

  const isDialogOpen = dialogState.type !== 'none'

  function handleOpenProjectForm() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    openProjectForm()
  }

  function handleOpenTagManager() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    setIsTagManagerOpen(true)
  }

  function handleImportClick() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    importInputRef.current?.click()
  }

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-semibold text-muted-foreground">プロジェクト</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenProjectForm}
          title={isAuthenticated ? '新規プロジェクト' : 'ログインして新規プロジェクト'}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {!isAuthenticated && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          閲覧モード
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {projects.map((project) => (
          <div
            key={project.id}
            className={cn(
              'group flex w-full items-center gap-2 rounded-md border-b border-l-2 border-b-border/50 px-3 py-2.5 text-sm transition-colors',
              selectedProjectId === project.id
                ? 'border-l-primary bg-accent text-accent-foreground'
                : 'border-l-transparent text-foreground hover:bg-accent/60'
            )}
          >
            <button
              className="flex min-w-0 flex-1 items-center gap-2"
              onClick={() => setSelectedProjectId(project.id)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate">{project.name}</span>
            </button>
            {isAuthenticated && (
              <>
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={() => openProjectEditForm(project.id)}
                  title="プロジェクトを編集"
                  aria-label={`${project.name} を編集`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-danger"
                  onClick={() =>
                    setDialogState({
                      type: 'deleteConfirm',
                      projectId: project.id,
                      projectName: project.name,
                    })
                  }
                  title="プロジェクトを削除"
                  aria-label={`${project.name} を削除`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}

        {projects.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">プロジェクトがありません</p>
          </div>
        )}
      </nav>

      <div className="grid grid-cols-4 gap-1 border-t border-border p-3">
        <Button variant="ghost" size="icon" onClick={toggleDark} title="テーマ切替">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenTagManager}
          title={isAuthenticated ? 'タグ管理' : 'ログインしてタグ管理'}
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
          onClick={handleImportClick}
          title={isAuthenticated ? 'JSONインポート' : 'ログインしてJSONインポート'}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsLicensesOpen(true)}
          title="ライセンス情報"
          aria-label="ライセンス情報"
        >
          <Info className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={isAuthenticated ? logout : openLoginDialog}
          title={isAuthenticated ? 'ログアウト' : 'ログイン'}
          aria-label={isAuthenticated ? 'ログアウト' : 'ログイン'}
        >
          {isAuthenticated ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
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
      {isLicensesOpen && <LicensesDialog onClose={() => setIsLicensesOpen(false)} />}

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
            {dialogState.type === 'deleteConfirm' && (
              <>
                <div className="mb-4 flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                  <div>
                    <Dialog.Title className="text-sm font-semibold">
                      プロジェクトの削除
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                      「{dialogState.projectName}
                      」とそのすべてのタスクを削除します。この操作は元に戻せません。
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
                  <Button variant="destructive" size="sm" onClick={handleDeleteProject}>
                    削除
                  </Button>
                </div>
              </>
            )}
            {dialogState.type === 'confirm' && (
              <>
                <div className="mb-4 flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
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
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                  <div>
                    <Dialog.Title className="text-sm font-semibold">エラー</Dialog.Title>
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
