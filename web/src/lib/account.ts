import { useQuery } from '@tanstack/react-query'

/**
 * Account page data layer against the existing Express endpoints.
 *
 * The context payload (`GET /api/account/context`, additive) mirrors the EJS
 * `/account` render: profile, login history, preferred-node list, and the
 * user's image submissions. Every mutation carries the session CSRF header.
 */

export interface AccountUser {
  id: number
  username: string | null
  email: string | null
  avatar: string | null
  description: string
  isAdmin: boolean
  createdAt: string
  preferredNodeId: number | null
  totpEnabled: boolean
}

export interface AccountContext {
  user: AccountUser
  loginHistory: {
    id: number
    timestamp: string
    ipAddress: string | null
    userAgent: string | null
  }[]
  nodes: { id: number; name: string; address: string }[]
  images: {
    id: number
    name: string
    status: string
    createdAt: string
    rejectionReason: string | null
  }[]
  allowed: boolean
  settings: { allowUserCreateImages: boolean }
}

export async function fetchAccountContext(): Promise<AccountContext> {
  const res = await fetch('/api/account/context', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to load account')
  return (await res.json()) as AccountContext
}

export function useAccountContext() {
  return useQuery({
    queryKey: ['account-context'],
    queryFn: fetchAccountContext,
  })
}

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

export async function updateDescription(
  description: string,
  csrf: string | null,
): Promise<void> {
  const res = await fetch('/update-description', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ description }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function updateUsername(
  newUsername: string,
  csrf: string | null,
): Promise<void> {
  const res = await fetch('/update-username', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ newUsername }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function checkUsername(username: string): Promise<boolean> {
  const res = await fetch(
    `/check-username?username=${encodeURIComponent(username)}`,
    { credentials: 'same-origin' },
  )
  if (!res.ok) throw new Error('Failed to check username')
  const data = (await res.json()) as { exists: boolean }
  return data.exists
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  csrf: string | null,
): Promise<void> {
  const res = await fetch('/change-password', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ currentPassword, newPassword }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function validatePassword(
  currentPassword: string,
  csrf: string | null,
): Promise<boolean> {
  const res = await fetch('/validate-password', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ currentPassword }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to validate password')
  const data = (await res.json()) as { valid?: boolean }
  return data.valid === true
}

export async function changeEmail(email: string, csrf: string | null): Promise<void> {
  const res = await fetch('/change-email', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ email }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function setPreferredNode(
  preferredNodeId: number | null,
  csrf: string | null,
): Promise<void> {
  const res = await fetch('/set-preferred-node', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ preferredNodeId: preferredNodeId ?? '' }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function setLanguage(language: string, csrf: string | null): Promise<void> {
  const res = await fetch('/set-language', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ language }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

/** Upload a new avatar; resolves with the new avatar path. */
export async function uploadAvatar(file: File, csrf: string | null): Promise<string> {
  const form = new FormData()
  form.append('avatar', file)
  const res = await fetch('/upload-avatar', {
    method: 'POST',
    headers: csrf ? { 'CSRF-Token': csrf } : {},
    body: form,
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as { avatar?: string }
  return data.avatar ?? ''
}

export async function removeAvatar(csrf: string | null): Promise<void> {
  const res = await fetch('/remove-avatar', {
    method: 'POST',
    headers: headers(csrf),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}
