import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LicenseEntry {
  licenses: string
  repository?: string
}

type LicenseMap = Record<string, LicenseEntry>

const MIT_LICENSE_TEXT = `MIT License

Copyright (c) 2026 佟 宇川

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

export function LicensesDialog({ onClose }: { onClose: () => void }) {
  const [licenses, setLicenses] = useState<LicenseMap | null>(null)
  const [error, setError] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
    fetch(`${base}third-party-licenses.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setLicenses)
      .catch(() => setError(true))
  }, [])

  const entries = licenses
    ? Object.entries(licenses).filter(([name]) => !name.startsWith('tasker@'))
    : []

  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[80vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-background shadow-lg focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <Dialog.Title className="text-sm font-semibold">ライセンス情報</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="閉じる">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-6 text-xs space-y-6">
            {/* Tasker 本体 */}
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                Tasker
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  v{__APP_VERSION__}
                </span>
              </h2>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                {MIT_LICENSE_TEXT}
              </pre>
            </section>

            {/* 依存ライブラリ */}
            <section>
              <h2 className="mb-3 text-sm font-semibold">使用ライブラリ</h2>
              {error && (
                <p className="text-muted-foreground">ライセンス情報を読み込めませんでした。</p>
              )}
              {!error && licenses === null && (
                <p className="text-muted-foreground">読み込み中...</p>
              )}
              {entries.length > 0 && (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">パッケージ</th>
                      <th className="pb-2 pr-4 font-medium">ライセンス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(([name, info]) => (
                      <tr key={name} className="border-b border-border/50">
                        <td className="py-1.5 pr-4">
                          {info.repository ? (
                            <a
                              href={info.repository}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {name}
                            </a>
                          ) : (
                            name
                          )}
                        </td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{info.licenses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
