import { useQuery } from '@tanstack/react-query'

/**
 * Admin panel data layer.
 *
 * Reads come from the two additive endpoints (`/api/admin/context` and
 * `/api/admin/page/:page`, which mirror the EJS admin page renders). Every
 * mutation posts to the existing `/admin/*` endpoints with the session CSRF
 * header — Express remains the mutation authority.
 */

/* ── Context + page data ─────────────────────────────────────────────────── */

export interface AdminSidebarGroup {
  section: string
  label: string
  items: {
    id: string
    label: string
    icon: string
    url: string
  }[]
}

export interface AdminContext {
  user: {
    id: number
    username: string | null
    email: string | null
    avatar: string | null
    isAdmin: boolean
    role: string | null
    totpEnabled: boolean
  }
  sidebarGroups: AdminSidebarGroup[]
  require2faForAdmins: boolean
}

export async function fetchAdminContext(): Promise<AdminContext> {
  const res = await fetch('/api/admin/context', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to load admin context')
  return (await res.json()) as AdminContext
}

export function useAdminContext() {
  return useQuery({
    queryKey: ['admin-context'],
    queryFn: fetchAdminContext,
  })
}

export interface AdminPageResponse<T> {
  success: boolean
  page: string
  data: T
}

export async function fetchAdminPage<T>(page: string, id?: number | string): Promise<T> {
  const qs = id !== undefined ? `?id=${encodeURIComponent(String(id))}` : ''
  const res = await fetch(`/api/admin/page/${page}${qs}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to load page data')
  const data = (await res.json()) as AdminPageResponse<T>
  return data.data
}

export function useAdminPage<T>(page: string, id?: number | string) {
  return useQuery({
    queryKey: ['admin-page', page, id ?? null],
    queryFn: () => fetchAdminPage<T>(page, id),
  })
}

/* ── Mutation helpers ────────────────────────────────────────────────────── */

function headers(csrfToken: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'CSRF-Token': csrfToken } : {}),
  }
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const data = JSON.parse(text) as { message?: string; error?: string }
    return data.message || data.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

export async function adminPost(
  url: string,
  body: unknown,
  csrf: string | null,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify(body ?? {}),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json().catch(() => ({}))) as Record<string, unknown>
}

export async function adminPut(
  url: string,
  body: unknown,
  csrf: string | null,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(csrf),
    body: JSON.stringify(body ?? {}),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json().catch(() => ({}))) as Record<string, unknown>
}

export async function adminDelete(
  url: string,
  csrf: string | null,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers(csrf),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json().catch(() => ({}))) as Record<string, unknown>
}

/* ── Users ───────────────────────────────────────────────────────────────── */

export const createUser = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/users/create-user', body, csrf)
export const updateUser = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPost(`/admin/users/update/${id}/`, body, csrf)
export const deleteUser = (id: number, csrf: string | null) =>
  adminDelete(`/admin/users/delete/${id}/`, csrf)
export const transferOwner = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPost(`/admin/users/transfer-owner/${id}/`, body, csrf)

/* ── Nodes ───────────────────────────────────────────────────────────────── */

export const createNode = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/nodes/create', body, csrf)
export const updateNode = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPut(`/admin/node/:id/edit`.replace(':id', String(id)), body, csrf)
export const deleteNode = (id: number, csrf: string | null) =>
  adminDelete(`/admin/node/${id}`, csrf)
export const verifyNode = (id: number, csrf: string | null) =>
  adminPost(`/admin/node/${id}/verify`, {}, csrf)

/* ── Servers ─────────────────────────────────────────────────────────────── */

export const createServerAdmin = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/servers/create', body, csrf)
export const updateServerAdmin = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPost(`/admin/servers/edit/${id}`, body, csrf)
export const deleteServerAdmin = (id: number, csrf: string | null) =>
  adminPost(`/admin/server/delete/${id}`, {}, csrf)
export const suspendServer = (id: number, csrf: string | null) =>
  adminPost(`/admin/servers/${id}/suspend`, {}, csrf)
export const unsuspendServer = (id: number, csrf: string | null) =>
  adminPost(`/admin/servers/${id}/unsuspend`, {}, csrf)
export const transferServer = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPost(`/admin/servers/${id}/transfer`, body, csrf)

/* ── Images ──────────────────────────────────────────────────────────────── */

export const createAdminImage = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/images/create', body, csrf)
export const updateAdminImage = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPost(`/admin/images/edit/${id}`, body, csrf)
export const deleteAdminImage = (id: number, csrf: string | null) =>
  adminPost(`/admin/images/delete/${id}`, {}, csrf)
export const approveImage = (id: number, csrf: string | null) =>
  adminPost(`/admin/images/approve/${id}`, {}, csrf)
export const rejectImage = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPost(`/admin/images/reject/${id}`, body, csrf)

/* ── API keys ────────────────────────────────────────────────────────────── */

export const createApiKey = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/apikeys/create', body, csrf)
export const updateApiKey = (id: number, body: Record<string, unknown>, csrf: string | null) =>
  adminPost(`/admin/apikeys/edit/${id}`, body, csrf)
export const toggleApiKey = (id: number, csrf: string | null) =>
  adminPost(`/admin/apikeys/toggle/${id}`, {}, csrf)
export const deleteApiKey = (id: number, csrf: string | null) =>
  adminPost(`/admin/apikeys/delete/${id}`, {}, csrf)

/* ── Databases ───────────────────────────────────────────────────────────── */

export const createDatabaseHost = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/databases/create', body, csrf)
export const testDatabaseHost = (id: number, csrf: string | null) =>
  adminPost(`/admin/databases/${id}/test`, {}, csrf)
export const deleteDatabaseHost = (id: number, csrf: string | null) =>
  adminDelete(`/admin/databases/${id}`, csrf)

/* ── Mounts ──────────────────────────────────────────────────────────────── */

export const createMount = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/mounts', body, csrf)
export const deleteMount = (id: number, csrf: string | null) =>
  adminDelete(`/admin/mounts/${id}`, csrf)

/* ── Addons ──────────────────────────────────────────────────────────────── */

export const toggleAddon = (slug: string, enabled: boolean, csrf: string | null) =>
  adminPost(`/admin/addons/toggle/${slug}`, { enabled }, csrf)
export const uninstallAddon = (slug: string, csrf: string | null) =>
  adminPost(`/admin/addons/uninstall/${slug}`, {}, csrf)
export const reloadAddons = (csrf: string | null) => adminPost('/admin/addons/reload', {}, csrf)

/* ── Settings ────────────────────────────────────────────────────────────── */

export const saveGeneralSettings = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/general', body, csrf)
export const saveSecuritySettings = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/security', body, csrf)
export const saveServerPolicy = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/server-policy', body, csrf)
export const saveSmtpSettings = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/smtp', body, csrf)
export const testSmtp = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/smtp/test', body, csrf)
export const saveS3Settings = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/s3', body, csrf)
export const resetSettings = (csrf: string | null) => adminPost('/admin/settings/reset', {}, csrf)
export const banIp = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/ban-ip', body, csrf)
export const unbanIp = (body: Record<string, unknown>, csrf: string | null) =>
  adminPost('/admin/settings/unban-ip', body, csrf)
