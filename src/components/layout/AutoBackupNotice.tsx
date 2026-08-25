import { useEffect } from 'react'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import { cn } from '@/utils/cn'

const AUTO_HIDE_MS = 8000

type Props = {
  status: 'success' | 'error'
  onDismiss: () => void
}

export function AutoBackupNotice({ status, onDismiss }: Props) {
  const isSuccess = status === 'success'

  useEffect(() => {
    // 失敗時は「JSONエクスポートで手動保存してください」という重要な情報を
    // 確認前に見失わないよう、手動で閉じるまで表示し続ける
    if (!isSuccess) return
    const timer = setTimeout(onDismiss, AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [isSuccess, onDismiss])

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={cn(
        'flex shrink-0 items-center gap-3 border-b px-5 py-2.5 text-sm font-medium',
        isSuccess
          ? 'border-[#8fc98f] bg-[#eaf7ea] text-[#245c24] dark:border-[#3f6b3f] dark:bg-[#1c2b1c] dark:text-[#c9ecc9]'
          : 'border-[#e7bd5b] bg-[#fff3cf] text-[#4b3510] dark:border-[#7a5a2a] dark:bg-[#2f2718] dark:text-[#f8e9c2]'
      )}
    >
      {isSuccess ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-[#2f8f2f] dark:text-[#7fd67f]" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#a76612] dark:text-[#f0b95c]" />
      )}
      <span className="flex-1">
        {isSuccess
          ? '本日分の自動バックアップを保存しました。'
          : '自動バックアップに失敗しました。JSONエクスポートで手動保存してください。'}
      </span>
      <button
        onClick={onDismiss}
        className="rounded-md p-1 hover:bg-white/45 dark:hover:bg-black/20"
        aria-label="自動バックアップ通知を閉じる"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
