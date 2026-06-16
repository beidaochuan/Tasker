import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'

export function LoginDialog() {
  const isOpen = useAuthStore((state) => state.isLoginDialogOpen)
  const close = useAuthStore((state) => state.closeLoginDialog)
  const login = useAuthStore((state) => state.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const ok = login(username, password)
    if (!ok) {
      setError('ユーザー名またはパスワードが違います')
      return
    }
    setUsername('')
    setPassword('')
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-primary" />
              <Dialog.Title className="text-sm font-semibold">ログイン</Dialog.Title>
            </div>
            <Button variant="ghost" size="icon" onClick={close} aria-label="閉じる">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Dialog.Description className="sr-only">
            編集機能を使うためのログインフォームです。
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-username" className="text-sm font-medium">
                ユーザー名
              </label>
              <input
                id="login-username"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError('')
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-sm font-medium">
                パスワード
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full">
              ログイン
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
