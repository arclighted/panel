import { describe, it, expect, vi, afterEach } from 'vitest'

import { queryClient } from '../lib/query-client'
import { powerAction, hasServerPermission } from '../lib/server'
import { deleteFile, fetchFileList } from '../lib/files'

afterEach(() => {
  vi.unstubAllGlobals()
  queryClient.clear()
})

describe('server power actions', () => {
  it('posts to the power endpoint with the session CSRF header', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe('/server/abc-123/power/start')
      return new Response(JSON.stringify({ success: true, message: 'Container is starting.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await powerAction('abc-123', 'start', 'test-token')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.['CSRF-Token']).toBe('test-token')
  })

  it('surfaces a queued start response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ queued: true, position: 2, message: 'Server queued to start (position 2).' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const result = await powerAction('abc-123', 'start', 'test-token')
    expect(result.queued).toBe(true)
    expect(result.position).toBe(2)
  })
})

describe('file actions', () => {
  it('parses the file list response from the existing endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            files: [
              { name: 'world', type: 'directory', size: 0, modifiedAt: null },
              { name: 'server.properties', type: 'file', size: 128, modifiedAt: '2026-01-01T00:00:00Z' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const files = await fetchFileList('abc-123', '/')
    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({ name: 'world', type: 'directory' })
  })

  it('deletes a file with a CSRF-guarded DELETE', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe(
        '/server/abc-123/files/rm/world%2Fregion.json',
      )
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await deleteFile('abc-123', 'world/region.json', 'test-token')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.method).toBe('DELETE')
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.['CSRF-Token']).toBe('test-token')
  })
})

describe('subuser permission gating', () => {
  it('mirrors subUserHasPermission: exact, wildcard and parent scopes', () => {
    expect(hasServerPermission(['files.delete'], 'files.delete')).toBe(true)
    expect(hasServerPermission(['files.*'], 'files.delete')).toBe(true)
    expect(hasServerPermission(['files'], 'files.delete')).toBe(true)
    expect(hasServerPermission(['console'], 'files.delete')).toBe(false)
    expect(hasServerPermission(['files.write'], 'files.delete')).toBe(false)
  })
})
