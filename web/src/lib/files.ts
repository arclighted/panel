import { useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * File manager data layer against the existing Express `/server/:id/files/*`
 * endpoints. Every mutation carries the session CSRF header and invalidates
 * the current directory listing on success.
 */

export interface FileEntry {
  name: string
  type: 'directory' | 'file'
  size: number
  modifiedAt: string | null
  category?: string
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff']

export function isImageFile(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.includes(extension)
}

export function joinPath(dir: string, name: string): string {
  const base = dir && dir !== '/' ? dir.replace(/^\/+|\/+$/g, '') : ''
  return base ? `${base}/${name}` : name
}

export async function fetchFileList(uuid: string, path: string): Promise<FileEntry[]> {
  const res = await fetch(
    `/server/${encodeURIComponent(uuid)}/files/list?path=${encodeURIComponent(path || '/')}`,
    { credentials: 'same-origin' },
  )
  if (!res.ok) {
    throw new Error('Failed to list files')
  }
  const data = (await res.json()) as { success: boolean; files?: FileEntry[] }
  return data.files ?? []
}

export function useFiles(uuid: string, path: string) {
  return useQuery({
    queryKey: ['server-files', uuid, path],
    queryFn: () => fetchFileList(uuid, path),
    enabled: typeof window !== 'undefined',
    staleTime: 5_000,
  })
}

function headers(csrfToken: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'CSRF-Token': csrfToken } : {}),
  }
}

async function parse(res: Response): Promise<{ success?: boolean; error?: string; message?: string }> {
  return (await res.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
    message?: string
  }
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return (uuid: string) => {
    void queryClient.invalidateQueries({ queryKey: ['server-files', uuid] })
  }
}

/** Delete one file/directory (the EJS calls rm once per path). */
export async function deleteFile(
  uuid: string,
  path: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(
    `/server/${encodeURIComponent(uuid)}/files/rm/${encodeURIComponent(path)}`,
    { method: 'DELETE', headers: headers(csrfToken), credentials: 'same-origin' },
  )
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to delete file.')
}

/** Create a directory at `parent` with `name`. */
export async function createFolder(
  uuid: string,
  parent: string,
  name: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/files/mkdir`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ path: parent || '/', name }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to create folder.')
}

/** Create an empty file at `path` via the save endpoint. */
export async function createFile(
  uuid: string,
  path: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/files/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ content: '' }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to create file.')
}

/** Move/rename a file or directory. */
export async function renameFile(
  uuid: string,
  oldPath: string,
  newPath: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/files/rename`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ oldPath, newPath }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to move file.')
}

/** Duplicate a file (daemon copies it in place with a ` (copy)` suffix). */
export async function copyFile(
  uuid: string,
  path: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/files/copy`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ location: path }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to duplicate file.')
}

/** Archive selected paths into `name.zip` in the current directory. */
export async function archiveFiles(
  uuid: string,
  paths: string[],
  name: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/zip`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ relativePath: paths, zipname: name }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to create archive.')
}

/** Extract `zipName` (full path) into its parent directory. */
export async function unzipFile(
  uuid: string,
  zipName: string,
  csrfToken: string | null,
): Promise<void> {
  const parent = zipName.includes('/')
    ? zipName.slice(0, zipName.lastIndexOf('/'))
    : '/'
  const fileName = zipName.split('/').pop() ?? zipName
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/unzip`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ relativePath: parent || '/', zipname: fileName }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to extract archive.')
}

/** Pull a file from a remote URL into `dir`. */
export async function pullFile(
  uuid: string,
  dir: string,
  url: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/files/pull`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ url, path: dir || '/' }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to pull file.')
}

/** Editor: load a text file's content via the additive content endpoint. */
export interface FileContent {
  name: string
  path: string
  extension: string
  content: string
  tooLarge: boolean
  invalidUtf8: boolean
  size: number
}

export async function fetchFileContent(uuid: string, path: string): Promise<FileContent> {
  const res = await fetch(
    `/server/${encodeURIComponent(uuid)}/files/content?path=${encodeURIComponent(path)}`,
    { credentials: 'same-origin' },
  )
  if (!res.ok) {
    throw new Error('Failed to load file content')
  }
  return (await res.json()) as FileContent
}

/** Editor: save file content via the existing save endpoint. */
export async function saveFile(
  uuid: string,
  path: string,
  content: string,
  csrfToken: string | null,
): Promise<void> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/files/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: headers(csrfToken),
    body: JSON.stringify({ content }),
    credentials: 'same-origin',
  })
  const data = await parse(res)
  if (!res.ok) throw new Error(data.error || 'Failed to save file.')
}

/** Upload one file with progress callbacks (XHR for upload progress). */
export function uploadFile(
  uuid: string,
  dir: string,
  file: File,
  csrfToken: string | null,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', dir || '/')
    formData.append('fileName', file.name)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/server/${encodeURIComponent(uuid)}/upload`)
    if (csrfToken) xhr.setRequestHeader('CSRF-Token', csrfToken)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      let message = 'Failed to upload file.'
      try {
        const data = JSON.parse(xhr.responseText) as { error?: string }
        if (data.error) message = data.error
      } catch {
        /* non-JSON error body */
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('Upload failed — network error.'))
    xhr.send(formData)
  })
}

/** Mutations that invalidate the file listing — used by the files page. */
export function useFileActions(uuid: string) {
  const invalidate = useInvalidate()
  return {
    invalidate: () => invalidate(uuid),
  }
}
