import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './githubRelease'

describe('isNewerVersion', () => {
  it.each([
    ['v0.15.0', '0.14.1'],
    ['1.0.1', '1.0.0'],
    ['1.1', '1.0.9'],
    ['2.0.0', '1.99.99'],
  ])('%s is newer than %s', (latest, current) => {
    expect(isNewerVersion(latest, current)).toBe(true)
  })

  it.each([
    ['v0.14.1', '0.14.1'],
    ['0.14.0', '0.14.1'],
    ['1.0.0', '1.0'],
    ['not-a-version', '1.0.0'],
  ])('%s is not newer than %s', (latest, current) => {
    expect(isNewerVersion(latest, current)).toBe(false)
  })
})
