/**
 * User "My Images" data layer against the existing Express endpoints
 * (`/my-images/*`). All mutations carry the session CSRF header.
 */

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

export interface ImageVariable {
  name?: string
  description?: string
  env_variable?: string
  defaultValue?: string
  rules?: string
}

export interface ImageDockerEntry {
  [key: string]: string
}

export interface ImageDetail {
  id: number
  name: string
  description: string | null
  author: string | null
  authorName: string | null
  startup: string
  stop: string | null
  status: string
  rejectionReason: string | null
  dockerImages: ImageDockerEntry[]
  variables: ImageVariable[]
}

export async function fetchImage(id: number): Promise<ImageDetail> {
  const res = await fetch(`/api/my-images/${id}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to load image')
  const data = (await res.json()) as { image: ImageDetail }
  return data.image
}

export async function createImage(
  payload: Record<string, unknown>,
  csrf: string | null,
): Promise<void> {
  const res = await fetch('/my-images/create', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function importImageUrl(url: string, csrf: string | null): Promise<void> {
  const res = await fetch('/my-images/import-url', {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify({ url }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function updateImage(
  id: number,
  state: string,
  payload: Record<string, unknown>,
  csrf: string | null,
): Promise<void> {
  const res = await fetch(`/my-images/update/${id}/${state}`, {
    method: 'POST',
    headers: headers(csrf),
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function deleteImage(id: number, csrf: string | null): Promise<void> {
  const res = await fetch(`/my-images/${id}`, {
    method: 'DELETE',
    headers: headers(csrf),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await parseError(res))
}
