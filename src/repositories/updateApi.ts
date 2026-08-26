import { z } from 'zod'
import { apiFetch } from './apiFetch'

const updateCapabilitySchema = z.object({ canSelfUpdate: z.boolean(), version: z.string() })
const updateProgressSchema = z.object({ steps: z.array(z.string()) })
const updateStartedSchema = z.object({ started: z.literal(true) })

export function getUpdateCapability() {
  return apiFetch('/api/update/status', { responseSchema: updateCapabilitySchema })
}

export function getUpdateProgress() {
  return apiFetch('/api/update/progress', { responseSchema: updateProgressSchema })
}

export function startSelfUpdate() {
  return apiFetch('/api/update', {
    responseSchema: updateStartedSchema,
    init: { method: 'POST' },
  })
}
