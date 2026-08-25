import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDailyBackupIfNeeded } from '@/utils/exportUtils'
import { useAutoBackupNotice } from './useAutoBackupNotice'

vi.mock('@/utils/exportUtils', () => ({ runDailyBackupIfNeeded: vi.fn() }))

describe('useAutoBackupNotice', () => {
  afterEach(() => {
    cleanup()
    vi.mocked(runDailyBackupIfNeeded).mockReset()
  })

  it('runDailyBackupIfNeededの解決前はcheckedがfalseのままである', () => {
    vi.mocked(runDailyBackupIfNeeded).mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useAutoBackupNotice())

    expect(result.current.checked).toBe(false)
    expect(result.current.status).toBeNull()
  })

  it('バックアップを実行した場合はstatusを"success"にし、checkedをtrueにする', async () => {
    vi.mocked(runDailyBackupIfNeeded).mockResolvedValue(true)
    const { result } = renderHook(() => useAutoBackupNotice())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.checked).toBe(true)
  })

  it('その日すでに実行済みでスキップした場合はstatusをnullのまま、checkedはtrueにする', async () => {
    vi.mocked(runDailyBackupIfNeeded).mockResolvedValue(false)
    const { result } = renderHook(() => useAutoBackupNotice())

    await waitFor(() => expect(result.current.checked).toBe(true))
    expect(result.current.status).toBeNull()
  })

  it('失敗時はstatusを"error"にし、checkedもtrueにする', async () => {
    vi.mocked(runDailyBackupIfNeeded).mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useAutoBackupNotice())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.checked).toBe(true)
  })

  it('dismiss()を呼ぶとstatusがnullに戻る', async () => {
    vi.mocked(runDailyBackupIfNeeded).mockResolvedValue(true)
    const { result } = renderHook(() => useAutoBackupNotice())

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.dismiss())

    expect(result.current.status).toBeNull()
  })
})
