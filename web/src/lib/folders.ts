import { queryClient } from './query-client'

/**
 * Folder mutations against the existing Express /api/folders endpoints.
 * Mutations carry the session CSRF token (POST/PATCH/DELETE are CSRF-guarded)
 * and invalidate the dashboard query on success.
 */

function headers(csrfToken: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'CSRF-Token': csrfToken } : {}),
  }
}

async function json(res: Response): Promise<{ success: boolean; error?: string }> {
  return (await res.json().catch(() => ({}))) as { success: boolean; error?: string }
}

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

export async function createFolder(
  name: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ name }),
    credentials: 'same-origin',
  })
  const data = await json(res)
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create folder.')
  }
  invalidate()
}

export async function deleteFolder(
  id: number,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/api/folders/${id}`, {
    method: 'DELETE',
    headers: headers(csrfToken),
    credentials: 'same-origin',
  })
  const data = await json(res)
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete folder.')
  }
  invalidate()
}

export async function addServerToFolder(
  folderId: number,
  serverUUID: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/api/folders/${folderId}/servers`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ serverUUID }),
    credentials: 'same-origin',
  })
  const data = await json(res)
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to add server to folder.')
  }
  invalidate()
}

export async function removeServerFromFolder(
  serverUUID: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/api/folders/servers/${serverUUID}`, {
    method: 'DELETE',
    headers: headers(csrfToken),
    credentials: 'same-origin',
  })
  const data = await json(res)
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to remove server from folder.')
  }
  invalidate()
}
