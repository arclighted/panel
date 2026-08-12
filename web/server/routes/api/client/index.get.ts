/**
 * GET /api/client — Nitro twin of the Express handler in
 * src/modules/api/client/clientApi.ts. Byte-identical (D3): introspection
 * behind the same apiValidator() gate.
 */
import { defineEventHandler } from 'h3'
import { requireApiKey } from '../../../utils/external-api'
import { CLIENT_API_VERSION } from '../../../../../src/modules/api/client/dto'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event)
  if (!guard.ok) return guard.response

  return {
    version: CLIENT_API_VERSION,
    endpoints: [
      { method: 'GET', path: '/api/client', description: 'Introspection – list client API routes' },
      { method: 'GET', path: '/api/client/servers', description: 'List your servers' },
      { method: 'GET', path: '/api/client/servers/:id', description: 'Get server details' },
      { method: 'POST', path: '/api/client/servers/:id/power', description: 'Power action (start/stop/restart/kill)' },
      { method: 'GET', path: '/api/client/servers/:id/files', description: 'List files', query: ['dir'] },
      { method: 'GET', path: '/api/client/servers/:id/files/content', description: 'Read file content', query: ['file'] },
      { method: 'POST', path: '/api/client/servers/:id/files/content', description: 'Write file content', body: ['file', 'content'] },
      { method: 'DELETE', path: '/api/client/servers/:id/files', description: 'Delete file', body: ['file'] },
      { method: 'POST', path: '/api/client/servers/:id/files/rename', description: 'Rename file', body: ['file', 'newname'] },
      { method: 'GET', path: '/api/client/servers/:id/backups', description: 'List backups' },
      { method: 'POST', path: '/api/client/servers/:id/backups', description: 'Create backup', body: ['name'] },
      { method: 'DELETE', path: '/api/client/servers/:id/backups/:backupId', description: 'Delete backup' },
      { method: 'GET', path: '/api/client/servers/:id/schedules', description: 'List schedules' },
      { method: 'POST', path: '/api/client/servers/:id/schedules', description: 'Create schedule', body: ['name', 'cron', 'action', 'payload'] },
      { method: 'DELETE', path: '/api/client/servers/:id/schedules/:scheduleId', description: 'Delete schedule' },
    ],
  }
})
