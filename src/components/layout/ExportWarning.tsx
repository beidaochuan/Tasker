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
    <div className="flex shrink-0 items-center gap-3 border-b border-amber-200/70 bg-amber-50/80 px-5 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <span className="flex-1">
        最後のエクスポートから 7 日以上経過しています。データをバックアップしてください。
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="border-amber-300 bg-background/80 hover:bg-background dark:border-amber-800"
      >
        <Download className="h-3.5 w-3.5" />
        今すぐエクスポート
      </Button>
      <button
        onClick={() => setShow(false)}
        className="rounded-md p-1 text-amber-900/70 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-100/70 dark:hover:bg-amber-950"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
