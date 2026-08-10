import { describe, it, expect, vi, afterEach } from 'vitest'

import { queryClient } from '../lib/query-client'
import { createRealtimeClient, type CreateRealtimeOptions } from '../lib/realtime'

/* Mock transport modelled on tests/realtime.test.ts in the root suite:
   a raw WebSocket that records sent frames, plus a reconnecting-websocket
   shim that proxies events and owns one underlying socket. */

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  sent: string[] = []
  private listeners: Record<string, Array<(evt: { data?: unknown }) => void>> = {}

  constructor(_url: string) {
    MockWebSocket.instances.push(this)
  }

  addEventListener(type: string, fn: (evt: { data?: unknown }) => void): void {
    ;(this.listeners[type] ??= []).push(fn)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN
    for (const fn of this.listeners.open ?? []) fn({})
  }

  emit(type: 'message', payload: unknown): void {
    for (const fn of this.listeners.message ?? []) {
      fn({ data: JSON.stringify(payload) })
    }
  }
}

class MockRWS {
  static instances: MockRWS[] = []
  socket: MockWebSocket
  private listeners: Record<string, Array<(evt: unknown) => void>> = {}
  private closed = false

  constructor(url: string, _protocols: string[] | undefined, _opts: Record<string, unknown>) {
    this.socket = new MockWebSocket(url)
    MockRWS.instances.push(this)
    ;(['open', 'message', 'close', 'error'] as const).forEach((type) => {
      this.socket.addEventListener(type, (evt) => this.emit(type, evt))
    })
  }

  addEventListener(type: string, fn: (evt: unknown) => void): void {
    ;(this.listeners[type] ??= []).push(fn)
  }

  emit(type: string, evt: unknown): void {
    if (this.closed) return
    // Message events arrive wrapped in a `{ data }` envelope, like the real
    // reconnecting-websocket transport delivers them.
    const event = type === 'message' ? { data: JSON.stringify(evt) } : evt
    for (const fn of this.listeners[type] ?? []) fn(event)
  }

  send(data: string): void {
    this.socket.send(data)
  }

  close(): void {
    this.closed = true
    this.socket.close()
  }

  reconnect(): void {
    this.closed = false
  }
}

function makeClient() {
  return createRealtimeClient({
    WebSocket: MockWebSocket as unknown as typeof WebSocket,
    ReconnectingWebSocket: MockRWS as unknown as CreateRealtimeOptions['ReconnectingWebSocket'],
    storage: null,
  })
}

afterEach(() => {
  MockWebSocket.instances = []
  MockRWS.instances = []
  queryClient.clear()
})

describe('realtime client protocol', () => {
  it('sends a sync handshake on open and answers pings', () => {
    makeClient()
    const rws = MockRWS.instances[0]
    expect(rws).toBeDefined()

    rws.emit('open', {})
    const handshake = JSON.parse(rws.socket.sent[0])
    expect(handshake).toEqual({ type: 'sync', sinceSeq: null })

    rws.emit('message', { type: 'ping' })
    const pong = JSON.parse(rws.socket.sent.at(-1))
    expect(pong).toEqual({ type: 'pong' })
  })

  it('tracks the connected status and re-issues watch guards after reconnect', () => {
    const client = makeClient()
    const rws = MockRWS.instances[0]
    rws.emit('open', {})
    rws.emit('message', { type: 'realtime.ready', seq: 5 })

    expect(client.status()).toBe('connected')

    client.watch('server-abc')
    client.watchEvents('server-abc')
    let sent = rws.socket.sent.map((s) => JSON.parse(s))
    expect(sent).toContainEqual({ type: 'watch', serverId: 'server-abc' })
    expect(sent).toContainEqual({ type: 'watchEvents', serverId: 'server-abc' })

    // Simulate a reconnect: another realtime.ready must re-send the watches.
    rws.emit('message', { type: 'realtime.ready', seq: 9 })
    sent = rws.socket.sent.map((s) => JSON.parse(s))
    expect(sent.filter((m) => m.type === 'watch' && m.serverId === 'server-abc').length).toBe(2)
  })

  it('routes status/stats/queue events into the server-live query cache', () => {
    makeClient()
    const rws = MockRWS.instances[0]
    rws.emit('open', {})
    rws.emit('message', { type: 'realtime.ready', seq: 1 })

    rws.emit('message', {
      type: 'server.status.changed',
      resource: { type: 'server', id: 'server-abc' },
      state: { running: true, startedAt: '2026-01-01T00:00:00Z' },
      seq: 2,
    })
    rws.emit('message', {
      type: 'server.stats.changed',
      resource: { type: 'server', id: 'server-abc' },
      state: { cpu: 42, memory: { percentage: 33 } },
      seq: 3,
    })
    rws.emit('message', {
      type: 'server.start.queued',
      resource: { type: 'server', id: 'server-abc' },
      state: { queued: true, position: 2, total: 4 },
      seq: 4,
    })

    const live = queryClient.getQueryData(['server-live', 'server-abc'])
    expect(live).toMatchObject({
      status: { running: true, startedAt: '2026-01-01T00:00:00Z' },
      stats: { cpu: 42, memory: { percentage: 33 } },
      queue: { queued: true, position: 2, total: 4 },
    })
  })

  it('clears the queue and invalidates dashboards on cancel/failure events', async () => {
    queryClient.setQueryData(['dashboard', 1], { servers: [] })
    makeClient()
    const rws = MockRWS.instances[0]
    rws.emit('open', {})
    rws.emit('message', { type: 'realtime.ready', seq: 1 })

    rws.emit('message', {
      type: 'server.start.cancelled',
      resource: { type: 'server', id: 'server-abc' },
      state: { queued: false },
      seq: 2,
    })

    const live = queryClient.getQueryData(['server-live', 'server-abc'])
    expect(live).toMatchObject({ queue: { queued: false, position: null } })

    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    rws.emit('message', {
      type: 'server.power.started',
      resource: { type: 'server', id: 'server-abc' },
      state: { running: true },
      seq: 3,
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
    spy.mockRestore()
  })
})
