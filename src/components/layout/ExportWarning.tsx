import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportAllData, shouldWarnAboutExport } from '@/utils/exportUtils'

export function ExportWarning() {
  const [show, setShow] = useState(() => shouldWarnAboutExport())

  async function handleExport() {
    await exportAllData()
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="flex items-center gap-3 border-b border-border bg-[hsl(var(--priority-medium)/0.15)] px-4 py-2 text-sm">
      <span className="flex-1 text-foreground">
        最後のエクスポートから 7 日以上経過しています。データをバックアップしてください。
      </span>
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="h-3.5 w-3.5" />
        今すぐエクスポート
      </Button>
      <button
        onClick={() => setShow(false)}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
