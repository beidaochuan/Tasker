import { useState } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
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
    <div className="flex shrink-0 items-center gap-3 border-b border-[#e7bd5b] bg-[#fff3cf] px-5 py-2.5 text-sm font-medium text-[#4b3510] shadow-[inset_0_-1px_0_rgba(180,122,24,0.18)] dark:border-[#7a5a2a] dark:bg-[#2f2718] dark:text-[#f8e9c2] dark:shadow-[inset_0_-1px_0_rgba(245,183,77,0.18)]">
      <AlertTriangle className="h-4 w-4 shrink-0 text-[#a76612] dark:text-[#f0b95c]" />
      <span className="flex-1">
        最後のエクスポートから 7 日以上経過しています。データをバックアップしてください。
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="border-[#b97818] bg-white/70 text-[#4b3510] hover:bg-white hover:text-[#4b3510] dark:border-[#c9933f] dark:bg-[#3b311e] dark:text-[#f8e9c2] dark:hover:bg-[#4a3b21] dark:hover:text-[#fff3cf]"
      >
        <Download className="h-3.5 w-3.5" />
        今すぐエクスポート
      </Button>
      <button
        onClick={() => setShow(false)}
        className="rounded-md p-1 text-[#6f4a14] hover:bg-white/45 hover:text-[#3a280c] dark:text-[#dfc58f] dark:hover:bg-[#4a3b21] dark:hover:text-[#fff3cf]"
        aria-label="バックアップ警告を閉じる"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
