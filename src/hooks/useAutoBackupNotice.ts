import { useCallback, useEffect, useState } from 'react'
import { runDailyBackupIfNeeded } from '@/utils/exportUtils'

export type AutoBackupStatus = 'success' | 'error' | null

export function useAutoBackupNotice() {
  const [status, setStatus] = useState<AutoBackupStatus>(null)
  // issue #14 のExportWarningとの競合対策: runDailyBackupIfNeeded()の完了を
  // 待ってからExportWarningをマウントすることで、自動バックアップによる
  // tasker_last_export の更新を反映した状態でその判定をさせる
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    runDailyBackupIfNeeded()
      .then((didBackup) => {
        if (didBackup) setStatus('success')
      })
      .catch((error) => {
        console.error('自動バックアップに失敗しました', error)
        setStatus('error')
      })
      .finally(() => setChecked(true))
  }, [])

  const dismiss = useCallback(() => setStatus(null), [])

  return { status, checked, dismiss }
}
