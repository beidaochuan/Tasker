import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutoBackupNotice } from './AutoBackupNotice'

describe('AutoBackupNotice', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('成功時は8秒後に自動的にonDismissを呼ぶ', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<AutoBackupNotice status="success" onDismiss={onDismiss} />)

    vi.advanceTimersByTime(7999)
    expect(onDismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('失敗時は自動的に消えず、手動で閉じるまで表示し続ける', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<AutoBackupNotice status="error" onDismiss={onDismiss} />)

    vi.advanceTimersByTime(60_000)

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('閉じるボタンをクリックすると即座にonDismissを呼ぶ', () => {
    const onDismiss = vi.fn()
    render(<AutoBackupNotice status="error" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByLabelText('自動バックアップ通知を閉じる'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('成功時はstatus="polite"のstatusロール、失敗時はassertiveなalertロールで通知する', () => {
    const { rerender } = render(<AutoBackupNotice status="success" onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

    rerender(<AutoBackupNotice status="error" onDismiss={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })
})
