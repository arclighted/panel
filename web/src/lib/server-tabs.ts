import { useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * Data layer for the migrated server tab pages (settings, startup, logs,
 * databases, schedules, backups, subusers).
 *
 * Page data reads the additive `/api/server/:id/*` endpoints; every mutation
 * reuses the existing Express `/server/:id/*` endpoints with the session CSRF
 * header, exactly like the EJS pages do.
 */

/* ── Shared types ───────────────────────────────────────────────────────── */

export interface AuthMeta {
  isAdmin: boolean
  isOwner: boolean
  isSubUser: boolean
  subUserPermissions: string[]
}

export function csrfHeaders(token: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    // The startup endpoints branch on Accept to decide between JSON responses
    // and legacy 302 redirects — always take the JSON branch (like the EJS
    // fetch calls do), so mutations never misreport a redirect as success.
    'Accept': 'application/json',
    ...(token ? { 'CSRF-Token': token } : {}),
  }
}

async function parseResult(res: Response): Promise<{ success?: boolean; error?: string; [k: string]: unknown }> {
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
    [k: string]: unknown
  }
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed')
  }
  return data
}

function useInvalidate(key: string, uuid: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: [key, uuid] })
  }
}

/* ── Settings ───────────────────────────────────────────────────────────── */

export interface SettingsTabPayload extends AuthMeta {
  server: {
    UUID: string
    id: number
    name: string
    description: string
    createdAt: string
    nodeName: string
    imageName: string
    memory: number
    cpu: number
    storage: number
    suspended: boolean
  }
  allowUserDeleteServer: boolean
}

export async function fetchSettingsTab(uuid: string): Promise<SettingsTabPayload> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/settings`, {
    credentials: 'same-origin',
  })
  const data = await parseResult(res)
  return data as unknown as SettingsTabPayload
}

export function useSettingsTab(uuid: string) {
  return useQuery({
    queryKey: ['server-settings', uuid],
    queryFn: () => fetchSettingsTab(uuid),
    enabled: typeof window !== 'undefined',
    staleTime: 30_000,
  })
}

export async function updateServerSettings(
  uuid: string,
  body: { name: string; description: string },
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/settings`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

/** Owner/self-service delete via the legacy user route. */
export async function deleteServerSelf(uuid: string, csrfToken: string | null): Promise<void> {
  const res = await fetch(`/user/server/${encodeURIComponent(uuid)}`, {
    method: 'DELETE',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

/** Admin delete via the admin route (numeric server id). */
export async function deleteServerAdmin(serverId: number, csrfToken: string | null): Promise<void> {
  const res = await fetch(`/admin/server/delete/${serverId}`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function reinstallServer(
  uuid: string,
  preserveData: boolean,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/reinstall`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ preserveData }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

/* ── Startup ────────────────────────────────────────────────────────────── */

export interface StartupVariable {
  name: string
  env: string
  type: 'boolean' | 'text' | 'number'
  default: string | number | boolean
  value: string | number | boolean
  rules?: string
  rules_field?: string
  rulesField?: string
  rulesMessage?: string
}

export interface StartupTabPayload extends AuthMeta {
  server: {
    UUID: string
    startCommand: string
    allowStartupEdit: boolean
  }
  currentDockerImage: string
  availableDockerImages: string[]
  variables: StartupVariable[]
}

export async function fetchStartupTab(uuid: string): Promise<StartupTabPayload> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/startup`, {
    credentials: 'same-origin',
  })
  const data = await parseResult(res)
  return data as unknown as StartupTabPayload
}

export function useStartupTab(uuid: string) {
  return useQuery({
    queryKey: ['server-startup', uuid],
    queryFn: () => fetchStartupTab(uuid),
    enabled: typeof window !== 'undefined',
    staleTime: 30_000,
  })
}

export async function updateStartupCommand(
  uuid: string,
  startCommand: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/startup/command`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ startCommand }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function updateDockerImage(
  uuid: string,
  dockerImage: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/startup/docker-image`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ dockerImage }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function updateStartupVariables(
  uuid: string,
  variables: StartupVariable[],
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/startup/variables`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ variables }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

/** Pterodactyl-style rule validation — mirrors validateVariableRules. */
export function validateVariableRules(
  variable: StartupVariable,
  value: string,
): string | null {
  const rawRules = variable.rules || variable.rules_field || variable.rulesField || ''
  if (typeof rawRules !== 'string' || rawRules.trim() === '') return null

  const valueLabel = variable.name || variable.env
  const rules = rawRules.split('|').map((r) => r.trim()).filter(Boolean)

  for (const rule of rules) {
    if (rule === 'required') {
      if (value === '') return `${valueLabel} is required.`
      continue
    }
    if (rule === 'string') continue
    if (rule === 'numeric') {
      if (value !== '' && isNaN(Number(value))) {
        return `${valueLabel} must be a number.`
      }
      continue
    }
    if (rule.startsWith('between:')) {
      const [minStr, maxStr] = rule.slice('between:'.length).split(',')
      const min = Number(minStr)
      const max = Number(maxStr)
      if (!isNaN(min) && !isNaN(max) && value !== '') {
        const num = Number(value)
        if (isNaN(num) || num < min || num > max) {
          return `${valueLabel} must be between ${min} and ${max}.`
        }
      }
      continue
    }
    if (rule.startsWith('min:')) {
      const min = Number(rule.slice('min:'.length))
      if (!isNaN(min) && value !== '' && (isNaN(Number(value)) || Number(value) < min)) {
        return `${valueLabel} must be at least ${min}.`
      }
      continue
    }
    if (rule.startsWith('max:')) {
      const max = Number(rule.slice('max:'.length))
      if (!isNaN(max) && value !== '' && (isNaN(Number(value)) || Number(value) > max)) {
        return `${valueLabel} must be at most ${max}.`
      }
      continue
    }
    if (rule.startsWith('regex:')) {
      const rawPattern = rule.slice('regex:'.length).trim()
      const match = /^\/(.*)\/([a-z]*)$/s.exec(rawPattern)
      const pattern = match && match[1] !== undefined ? match[1] : rawPattern
      const flags = match ? match[2] : ''
      let re: RegExp
      try {
        re = new RegExp(pattern, flags)
      } catch {
        continue
      }
      if (value !== '' && !re.test(value)) {
        return variable.rulesMessage || `${valueLabel} does not match the required pattern.`
      }
      continue
    }
    if (rule.startsWith('in:')) {
      const allowed = rule.slice('in:'.length).split(',').map((s) => s.trim()).filter(Boolean)
      if (allowed.length > 0 && !allowed.includes(value)) {
        return `${valueLabel} must be one of: ${allowed.join(', ')}.`
      }
    }
  }
  return null
}

/* ── Databases ──────────────────────────────────────────────────────────── */

export interface DatabaseRecord {
  id: number
  databaseName: string
  databaseUser: string
  databasePassword: string
  createdAt: string
  host: { name: string; host: string; port: number }
}

export interface DatabaseHost {
  id: number
  name: string
  host: string
  port: number
}

export interface DatabasesTabPayload extends AuthMeta {
  databases: DatabaseRecord[]
  hosts: DatabaseHost[]
  userDbLimit: number
  userDbCount: number
}

export async function fetchDatabasesTab(uuid: string): Promise<DatabasesTabPayload> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/databases`, {
    credentials: 'same-origin',
  })
  const data = await parseResult(res)
  return data as unknown as DatabasesTabPayload
}

export function useDatabasesTab(uuid: string) {
  return useQuery({
    queryKey: ['server-databases', uuid],
    queryFn: () => fetchDatabasesTab(uuid),
    enabled: typeof window !== 'undefined',
    staleTime: 15_000,
  })
}

export async function createDatabase(
  uuid: string,
  hostId: number,
  csrfToken: string | null,
): Promise<DatabaseRecord> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/databases`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ hostId: String(hostId) }),
    credentials: 'same-origin',
  })
  const data = (await parseResult(res)) as { database?: DatabaseRecord }
  if (!data.database) throw new Error('Failed to create database.')
  return data.database
}

export async function deleteDatabase(
  uuid: string,
  dbId: number,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/databases/${dbId}`, {
    method: 'DELETE',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function rotateDatabasePassword(
  uuid: string,
  dbId: number,
  csrfToken: string | null,
): Promise<string> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/databases/${dbId}/rotate-password`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  const data = (await parseResult(res)) as { password?: string }
  if (!data.password) throw new Error('Failed to rotate password.')
  return data.password
}

export function useDatabaseActions(uuid: string) {
  const invalidate = useInvalidate('server-databases', uuid)
  return { invalidate }
}

/* ── Schedules ──────────────────────────────────────────────────────────── */

export interface ScheduleTask {
  id: number
  action: 'command' | 'power' | 'backup'
  payload: Record<string, unknown>
  timeOffset: number
}

export interface ScheduleRecord {
  id: number
  name: string
  cron: string
  enabled: boolean
  timeOffset: number
  nextRunAt: string | null
  lastRunAt: string | null
  tasks: ScheduleTask[]
}

export interface SchedulesTabPayload extends AuthMeta {
  schedules: ScheduleRecord[]
}

export async function fetchSchedulesTab(uuid: string): Promise<SchedulesTabPayload> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/schedules`, {
    credentials: 'same-origin',
  })
  const data = await parseResult(res)
  return data as unknown as SchedulesTabPayload
}

export function useSchedulesTab(uuid: string) {
  return useQuery({
    queryKey: ['server-schedules', uuid],
    queryFn: () => fetchSchedulesTab(uuid),
    enabled: typeof window !== 'undefined',
    staleTime: 15_000,
  })
}

export async function createSchedule(
  uuid: string,
  body: { name: string; cron: string; timeOffset: number },
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/schedules`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function toggleSchedule(
  uuid: string,
  scheduleId: number,
  enabled: boolean,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/schedules/${scheduleId}`, {
    method: 'PATCH',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ enabled }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function deleteSchedule(
  uuid: string,
  scheduleId: number,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/schedules/${scheduleId}`, {
    method: 'DELETE',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function runScheduleNow(
  uuid: string,
  scheduleId: number,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/schedules/${scheduleId}/run`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function addScheduleTask(
  uuid: string,
  scheduleId: number,
  task: { action: 'command' | 'power' | 'backup'; payload: Record<string, unknown>; timeOffset: number },
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/schedules/${scheduleId}/tasks`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify(task),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function deleteScheduleTask(
  uuid: string,
  scheduleId: number,
  taskId: number,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/schedules/${scheduleId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export function useScheduleActions(uuid: string) {
  const invalidate = useInvalidate('server-schedules', uuid)
  return { invalidate }
}

/* ── Cron helpers (mirror the EJS schedule builder) ─────────────────────── */

const FIELD_BOUNDS: [number, number][] = [
  [0, 59], [0, 59], [0, 23], [1, 31], [1, 12], [0, 7],
]

export function tokenValid(tok: string, bounds: [number, number]): boolean {
  if (tok === '*') return true
  const [lo, hi] = bounds
  for (const item of tok.split(',')) {
    const m = item.match(/^\*\/?([0-9]+)?$|^(\*|(\d+)(?:-(\d+))?)$/)
    if (!m) return false
    if (m[1] !== undefined) {
      const n = +m[1]
      if (!(n >= 1 && n <= hi)) return false
    } else if (m[2] === '*') {
      continue
    } else {
      const a = +m[3]
      const b = m[4] !== undefined ? +m[4] : a
      if (a < lo || a > hi || b < lo || b > hi || b < a) return false
    }
  }
  return true
}

/** 5- or 6-field cron validation (second minute hour dom month dow). */
export function validCron(c: string): boolean {
  const parts = String(c || '').trim().split(/\s+/)
  if (parts.length !== 5 && parts.length !== 6) return false
  const bounds = parts.length === 6 ? FIELD_BOUNDS : FIELD_BOUNDS.slice(1)
  return parts.every((t, i) => tokenValid(t, bounds[i]))
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface CronToken {
  kind: 'num' | 'int' | 'any' | 'list'
  value?: number
  step?: number
}

function splitCronField(v: string): CronToken[] {
  const parts: CronToken[] = []
  for (const item of v.split(',')) {
    if (item === '*') { parts.push({ kind: 'any' }); continue }
    const step = item.match(/^\*\/(\d+)$/)
    if (step) { parts.push({ kind: 'int', step: +step[1] }); continue }
    const range = item.match(/^(\d+)(?:-(\d+))?$/)
    if (range) {
      const a = +range[1]
      const b = range[2] !== undefined ? +range[2] : a
      if (b === a) { parts.push({ kind: 'num', value: a }); continue }
      parts.push({ kind: 'int', value: a, step: b - a + 1 })
    }
  }
  return parts
}

function fmtClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`
}

function describeTime(minF: string, hourF: string): string {
  const min = splitCronField(minF)
  const hour = splitCronField(hourF)
  const minNum = min.length === 1 && min[0].kind === 'num' ? (min[0].value ?? null) : null
  const hourNum = hour.length === 1 && hour[0].kind === 'num' ? (hour[0].value ?? null) : null
  const minInt = min.length === 1 && min[0].kind === 'int' ? min[0].step ?? null : null
  const hourInt = hour.length === 1 && hour[0].kind === 'int' ? hour[0].step ?? null : null

  if (minF === '*') {
    if (hourF === '*') return 'every minute'
    if (hourInt !== null) return `every minute during every ${hourInt} hours`
    if (hourNum !== null) return `every minute during hour ${hourNum}`
    return `every minute during hours ${hourF}`
  }
  if (minInt !== null) {
    if (hourF === '*') return `every ${minInt} minutes`
    if (hourNum !== null) return `every ${minInt} minutes in hour ${hourNum}`
    return `every ${minInt} minutes, every ${hourInt ?? '?'} hours`
  }
  if (minNum !== null) {
    if (hourF === '*') return minNum === 0 ? 'every hour' : `every hour at minute ${minNum}`
    if (hourNum !== null) return `at ${fmtClock(hourNum, minNum)}`
    if (hourInt !== null) return minNum === 0 ? `every ${hourInt} hours` : `every ${hourInt} hours at minute ${minNum}`
    return `at minute ${minNum} during hours ${hourF}`
  }
  if (hourF === '*') return `every hour at minutes ${minF}`
  return `at minutes ${minF} during hours ${hourF}`
}

function describeDate(domF: string, monF: string, dowF: string): string | null {
  const dom = splitCronField(domF)
  const mon = splitCronField(monF)
  const dow = splitCronField(dowF)
  const bits: string[] = []

  const one = (f: CronToken[]): number | null => (
    f.length === 1 && f[0].kind === 'num' ? f[0].value ?? null : null
  )
  const intv = (f: CronToken[]): number | null => (
    f.length === 1 && f[0].kind === 'int' ? f[0].step ?? null : null
  )
  const dowNum = one(dow)
  const dowInt = intv(dow)
  if (dowF !== '*') {
    if (dowInt !== null) {
      bits.push(`every ${dowInt} days of the week`)
    } else if (dow.length === 1 && dowNum !== null) {
      bits.push(`every ${DAY_NAMES[dowNum % 7] ?? 'day ' + dowNum}`)
    } else {
      bits.push(
        `on ${dowF.split(',').map((t) => {
          const m = t.match(/^(\d+)(?:-(\d+))?$/)
          if (!m) return t
          return m[2] !== undefined
            ? `${DAY_NAMES[+m[1] % 7]?.slice(0, 3)}-${DAY_NAMES[+m[2] % 7]?.slice(0, 3)}`
            : DAY_NAMES[+m[1] % 7]?.slice(0, 3)
        }).join(', ')}`,
      )
    }
  }
  const domNum = one(dom)
  const domInt = intv(dom)
  if (domF !== '*') {
    if (domInt !== null) {
      bits.push(`every ${domInt} days of the month`)
    } else if (dom.length === 1 && domNum !== null) {
      bits.push(`on day ${domNum} of the month`)
    } else {
      bits.push(`on days ${domF} of the month`)
    }
  }
  const monNum = one(mon)
  const monInt = intv(mon)
  if (monF !== '*') {
    if (monInt !== null) {
      bits.push(`every ${monInt} months`)
    } else if (mon.length === 1 && monNum !== null) {
      bits.push(`in ${['January','February','March','April','May','June','July','August','September','October','November','December'][Math.min(12, Math.max(1, monNum)) - 1] ?? 'month ' + monNum}`)
    } else {
      bits.push(`in months ${monF}`)
    }
  }
  return bits.length > 0 ? bits.join(', ') : null
}

function describeCron5(expr: string): string {
  const p = String(expr || '').trim().split(/\s+/)
  if (p.length !== 5) return String(expr || '').trim() || 'invalid cron'
  const [minF, hourF, domF, monF, dowF] = p
  const time = describeTime(minF, hourF)
  const date = describeDate(domF, monF, dowF)
  return [time, date].filter(Boolean).join(' ')
}

/** Human-readable description of a 5- or 6-field cron expression. */
export function describeCron(expr: string): string {
  const p = String(expr || '').trim().split(/\s+/)
  if (p.length === 6) {
    const rest = describeCron5(p.slice(1).join(' '))
    if (p[0] === '*') return rest === 'every minute' ? 'every second' : `every second, ${rest}`
    if (p[0] === '0') return rest
    if (/^\*\/\d+$/.test(p[0])) {
      return `every ${p[0].slice(2)} seconds` + (rest === 'every minute' ? '' : `, ${rest}`)
    }
    return `at second ${p[0]}, ${rest}`
  }
  return describeCron5(p.join(' '))
}

/** Serialize the visual builder fields into a 6-field cron string. */
export function buildGranularCron(
  granular: Record<'sec' | 'min' | 'hour' | 'dom', { value: number; every: boolean; interval: number | null }>,
  dowAll: boolean,
  dowDays: Set<number>,
): string {
  const field = (key: 'sec' | 'min' | 'hour' | 'dom'): string => {
    const f = granular[key]
    if (f.every) return f.interval !== null ? `*/${f.interval}` : '*'
    return String(Math.min([59, 59, 23, 31][['sec', 'min', 'hour', 'dom'].indexOf(key)], Math.max([0, 0, 0, 1][['sec', 'min', 'hour', 'dom'].indexOf(key)], f.value)))
  }
  const dow = dowAll || dowDays.size === 0 || dowDays.size === 7
    ? '*'
    : [...dowDays].sort((a, b) => a - b).join(',')
  return [field('sec'), field('min'), field('hour'), field('dom'), '*', dow].join(' ')
}

/* ── Backups ────────────────────────────────────────────────────────────── */

export interface BackupRecord {
  UUID: string
  name: string
  size: string
  checksum: string | null
  locked: boolean
  createdAt: string
}

export interface BackupsTabPayload extends AuthMeta {
  backups: BackupRecord[]
}

export async function fetchBackupsTab(uuid: string): Promise<BackupsTabPayload> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/backups`, {
    credentials: 'same-origin',
  })
  const data = await parseResult(res)
  return data as unknown as BackupsTabPayload
}

export function useBackupsTab(uuid: string) {
  return useQuery({
    queryKey: ['server-backups', uuid],
    queryFn: () => fetchBackupsTab(uuid),
    enabled: typeof window !== 'undefined',
    staleTime: 15_000,
  })
}

export async function createBackup(
  uuid: string,
  name: string,
  csrfToken: string | null,
): Promise<BackupRecord> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/backups/create`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ name }),
    credentials: 'same-origin',
  })
  const data = (await parseResult(res)) as { backup?: BackupRecord }
  if (!data.backup) throw new Error('Failed to create backup.')
  return data.backup
}

export async function restoreBackup(
  uuid: string,
  backupId: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/backups/${encodeURIComponent(backupId)}/restore`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function toggleBackupLock(
  uuid: string,
  backupId: string,
  locked: boolean,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/backups/${encodeURIComponent(backupId)}/lock`, {
    method: 'PATCH',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ locked }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function deleteBackup(
  uuid: string,
  backupId: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/backups/${encodeURIComponent(backupId)}`, {
    method: 'DELETE',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export function useBackupActions(uuid: string) {
  const invalidate = useInvalidate('server-backups', uuid)
  return { invalidate }
}

export function formatBackupSize(size: string): string {
  const n = Number(size)
  if (!n || isNaN(n) || n <= 0) return 'Unknown'
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/* ── Subusers ───────────────────────────────────────────────────────────── */

export interface SubUserRecord {
  id: number
  permissions: string[]
  user: { id: number | null; username: string; email: string; avatar: string | null }
}

export interface PermissionGroup {
  title: string
  perms: string[]
}

export interface SubusersTabPayload {
  subUsers: SubUserRecord[]
  permissionLabels: Record<string, string>
  permissionGroups: PermissionGroup[]
  isOwner: boolean
  isAdmin: boolean
}

export async function fetchSubusersTab(uuid: string): Promise<SubusersTabPayload> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/subusers`, {
    credentials: 'same-origin',
  })
  const data = await parseResult(res)
  return data as unknown as SubusersTabPayload
}

export function useSubusersTab(uuid: string) {
  return useQuery({
    queryKey: ['server-subusers', uuid],
    queryFn: () => fetchSubusersTab(uuid),
    enabled: typeof window !== 'undefined',
    staleTime: 15_000,
  })
}

export async function addSubUser(
  uuid: string,
  email: string,
  permissions: string[],
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/subusers`, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ email, permissions }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function updateSubUserPermissions(
  uuid: string,
  subUserId: number,
  permissions: string[],
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/subusers/${subUserId}`, {
    method: 'PUT',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ permissions }),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export async function removeSubUser(
  uuid: string,
  subUserId: number,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/subusers/${subUserId}`, {
    method: 'DELETE',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  await parseResult(res)
}

export function useSubUserActions(uuid: string) {
  const invalidate = useInvalidate('server-subusers', uuid)
  return { invalidate }
}

/* ── Logs (page data comes from existing JSON endpoints) ────────────────── */

export interface LogArchive {
  fileName: string
  size: number
  createdAt: string
}

export async function fetchLogHistory(uuid: string): Promise<string[]> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/logs/history`, {
    credentials: 'same-origin',
  })
  const data = (await res.json().catch(() => ({}))) as { logs?: string[] }
  if (!res.ok) throw new Error('Failed to load recent output.')
  return data.logs ?? []
}

export async function fetchLogArchives(uuid: string): Promise<LogArchive[]> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/logs/archives`, {
    credentials: 'same-origin',
  })
  const data = (await res.json().catch(() => ({}))) as { logs?: LogArchive[] }
  if (!res.ok) throw new Error('Failed to load saved logs.')
  return data.logs ?? []
}

export async function fetchLogArchiveContent(uuid: string, file: string): Promise<string[]> {
  const res = await fetch(
    `/server/${encodeURIComponent(uuid)}/logs/archives/read?file=${encodeURIComponent(file)}`,
    { credentials: 'same-origin' },
  )
  const data = (await res.json().catch(() => ({}))) as { lines?: string[] }
  if (!res.ok) throw new Error('Failed to read archive.')
  return data.lines ?? []
}

export function formatBytes(bytes: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return 'Unknown'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
