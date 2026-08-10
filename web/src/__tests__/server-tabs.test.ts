import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  validCron,
  describeCron,
  buildGranularCron,
  validateVariableRules,
  createSchedule,
  toggleSchedule,
  addScheduleTask,
  createBackup,
  addSubUser,
  deleteDatabase,
  rotateDatabasePassword,
  updateStartupVariables,
} from '@/lib/server-tabs'

/* ── Cron validation (mirrors the EJS schedule builder) ─────────────────── */

describe('validCron', () => {
  it('accepts 5-field and 6-field expressions', () => {
    expect(validCron('0 0 * * *')).toBe(true)
    expect(validCron('0 0 * * * *')).toBe(true)
  })

  it('rejects wrong field counts', () => {
    expect(validCron('0 0 * *')).toBe(false)
    expect(validCron('0 0 * * * * *')).toBe(false)
    expect(validCron('')).toBe(false)
  })

  it('rejects out-of-range values', () => {
    expect(validCron('60 0 * * * *')).toBe(false)
    expect(validCron('0 60 * * * *')).toBe(false)
    expect(validCron('0 0 24 * * *')).toBe(false)
    expect(validCron('0 0 -1 * * *')).toBe(false)
    expect(validCron('0 0 * * 13 *')).toBe(false)
    expect(validCron('0 0 * * * 8')).toBe(false)
  })

  it('accepts ranges, lists, steps and wildcards', () => {
    expect(validCron('*/5 * * * * *')).toBe(true)
    expect(validCron('0 0 1-15 * * *')).toBe(true)
    expect(validCron('0 0 * * 1,3,5 *')).toBe(true)
    expect(validCron('0 0 * * * 1-5')).toBe(true)
  })

  it('rejects malformed tokens', () => {
    expect(validCron('foo * * * * *')).toBe(false)
    expect(validCron('0 0 5-2 * * *')).toBe(false)
  })
})

/* ── Human-readable cron description ────────────────────────────────────── */

describe('describeCron', () => {
  it('describes a daily midnight run (5-field)', () => {
    expect(describeCron('0 0 * * *')).toBe('at 12:00 AM')
  })

  it('describes a 6-field hourly run', () => {
    expect(describeCron('0 0 * * * *')).toBe('every hour')
  })

  it('describes every-N minutes', () => {
    expect(describeCron('*/5 * * * *')).toBe('every 5 minutes')
  })

  it('describes every-N hours', () => {
    expect(describeCron('0 */2 * * *')).toBe('every 2 hours')
  })

  it('handles a specific time of day', () => {
    expect(describeCron('30 14 * * *')).toBe('at 2:30 PM')
  })
})

/* ── Visual builder serialization ───────────────────────────────────────── */

describe('buildGranularCron', () => {
  const base = {
    sec: { value: 0, every: true, interval: null },
    min: { value: 0, every: true, interval: null },
    hour: { value: 0, every: true, interval: null },
    dom: { value: 1, every: true, interval: null },
  }

  it('builds an every-day expression by default', () => {
    expect(buildGranularCron(base, true, new Set())).toBe('* * * * * *')
  })

  it('serializes a specific hour/minute', () => {
    const granular = {
      ...base,
      min: { value: 30, every: false, interval: null },
      hour: { value: 14, every: false, interval: null },
    }
    expect(buildGranularCron(granular, true, new Set())).toBe('* 30 14 * * *')
  })

  it('serializes every-N intervals', () => {
    const granular = { ...base, min: { value: 0, every: true, interval: 5 } }
    expect(buildGranularCron(granular, true, new Set())).toBe('* */5 * * * *')
  })

  it('serializes selected weekdays', () => {
    expect(buildGranularCron(base, false, new Set([1, 3]))).toBe('* * * * * 1,3')
  })
})

/* ── Startup variable rule validation (mirrors validateVariableRules) ───── */

describe('validateVariableRules', () => {
  const variable = {
    name: 'Test Var',
    env: 'TEST_VAR',
    type: 'text' as const,
    default: '',
    value: '',
    rules: 'required|between:1,10',
  }

  it('passes valid values', () => {
    expect(validateVariableRules(variable, '5')).toBeNull()
  })

  it('rejects empty required values', () => {
    expect(validateVariableRules(variable, '')).toBe('Test Var is required.')
  })

  it('rejects out-of-range numeric values', () => {
    expect(validateVariableRules(variable, 'waytoolongvalue')).toBe(
      'Test Var must be between 1 and 10.',
    )
  })

  it('validates numeric type', () => {
    const numeric = { ...variable, rules: 'numeric' }
    expect(validateVariableRules(numeric, 'notanumber')).toBe('Test Var must be a number.')
    expect(validateVariableRules(numeric, '42')).toBeNull()
  })

  it('validates regex rules with custom messages', () => {
    const regex = {
      ...variable,
      rules: 'regex:/^[a-z0-9]+$/i',
      rulesMessage: 'Letters and numbers only.',
    }
    expect(validateVariableRules(regex, 'ok123')).toBeNull()
    expect(validateVariableRules(regex, 'bad space')).toBe('Letters and numbers only.')
  })

  it('returns null when no rules are present', () => {
    expect(validateVariableRules({ ...variable, rules: '' }, 'anything')).toBeNull()
  })
})

/* ── Mutation contracts (URL, method, CSRF header) ──────────────────────── */

describe('tab mutation contracts', () => {
  const fetchMock = vi.fn()
  const CSRF = 'token-123'

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('createSchedule POSTs the name/cron/offset to /schedules', async () => {
    await createSchedule('uuid1', { name: 'Daily', cron: '0 0 * * * *', timeOffset: 0 }, CSRF)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/server/uuid1/schedules')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['CSRF-Token']).toBe(CSRF)
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Daily',
      cron: '0 0 * * * *',
      timeOffset: 0,
    })
  })

  it('toggleSchedule PATCHes the enabled flag', async () => {
    await toggleSchedule('uuid1', 7, false, CSRF)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/server/uuid1/schedules/7')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ enabled: false })
  })

  it('addScheduleTask posts the payload shape for command tasks', async () => {
    await addScheduleTask('uuid1', 7, { action: 'command', payload: { command: 'say hi' }, timeOffset: 0 }, CSRF)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      action: 'command',
      payload: { command: 'say hi' },
      timeOffset: 0,
    })
  })

  it('deleteDatabase sends DELETE with the CSRF header', async () => {
    await deleteDatabase('uuid1', 42, CSRF)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/server/uuid1/databases/42')
    expect(init.method).toBe('DELETE')
    expect((init.headers as Record<string, string>)['CSRF-Token']).toBe(CSRF)
  })

  it('rotateDatabasePassword posts to the rotate endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, password: 'newpass' }),
    })
    const password = await rotateDatabasePassword('uuid1', 42, CSRF)
    expect(password).toBe('newpass')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/server/uuid1/databases/42/rotate-password')
    expect(init.method).toBe('POST')
  })

  it('createBackup posts the name and returns the backup record', async () => {
    const backup = { UUID: 'b1', name: 'daily', size: '1048576', checksum: null, locked: false, createdAt: '2026-01-01' }
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, backup }),
    })
    const result = await createBackup('uuid1', 'daily', CSRF)
    expect(result.UUID).toBe('b1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/server/uuid1/backups/create')
    expect(JSON.parse(String(init.body))).toEqual({ name: 'daily' })
  })

  it('addSubUser posts the email + permission list', async () => {
    await addSubUser('uuid1', 'friend@example.com', ['console', 'files.read'], CSRF)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/server/uuid1/subusers')
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'friend@example.com',
      permissions: ['console', 'files.read'],
    })
  })

  it('updateStartupVariables posts the full variable payload as JSON', async () => {
    await updateStartupVariables('uuid1', [{ name: 'V', env: 'V', type: 'text', default: '', value: 'x' }], CSRF)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/server/uuid1/startup/variables')
    expect(JSON.parse(String(init.body))).toEqual({
      variables: [{ name: 'V', env: 'V', type: 'text', default: '', value: 'x' }],
    })
  })

  it('surfaces error messages from non-ok responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid cron expression.' }),
    })
    await expect(createSchedule('uuid1', { name: 'x', cron: 'bad', timeOffset: 0 }, CSRF)).rejects.toThrow(
      'Invalid cron expression.',
    )
  })
})
