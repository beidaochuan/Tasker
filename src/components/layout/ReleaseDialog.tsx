import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle, ExternalLink, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GitHubRelease } from '@/utils/githubRelease'

export type ReleaseCheckState =
  | { type: 'checking' }
  | { type: 'available'; release: GitHubRelease }
  | { type: 'upToDate'; release: GitHubRelease }
  | { type: 'error'; message: string }

interface ReleaseDialogProps {
  state: ReleaseCheckState
  onClose: () => void
  onRetry: () => void
}

export function ReleaseDialog({ state, onClose, onRetry }: ReleaseDialogProps) {
  const isAvailable = state.type === 'available'

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none">
          <div className="mb-4 flex items-start gap-3">
            {state.type === 'checking' ? (
              <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
            ) : state.type === 'error' ? (
              <X className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            ) : (
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            )}
            <div>
              <Dialog.Title className="text-sm font-semibold">
                {state.type === 'checking'
                  ? '更新を確認中'
                  : isAvailable
                    ? '新しいバージョンがあります'
                    : state.type === 'upToDate'
                      ? '最新バージョンです'
                      : '更新の確認に失敗しました'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                {state.type === 'checking' && 'GitHub Releases を確認しています...'}
                {isAvailable && `Tasker ${state.release.version} を利用できます。`}
                {state.type === 'upToDate' && `現在のバージョン（v${__APP_VERSION__}）は最新です。`}
                {state.type === 'error' && state.message}
              </Dialog.Description>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {state.type === 'error' && (
              <Button size="sm" onClick={onRetry}>
                再試行
              </Button>
            )}
            {isAvailable && (
              <a
                href={state.release.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                GitHub Releases を開く
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button variant={isAvailable ? 'outline' : 'default'} size="sm" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
