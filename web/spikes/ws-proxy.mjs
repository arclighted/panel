#!/usr/bin/env node
/**
 * WS proxy spike — validates that the net.connect WS upgrade approach works.
 *
 * Steps:
 * 1. Starts a simple WebSocket echo server on port 19999
 * 2. Creates an HTTP proxy on port 19998 that forwards /ws → 19999
 * 3. Connects a WebSocket client to the proxy at ws://127.0.0.1:19998/ws
 * 4. Sends a message, expects echo back, verifies
 * 5. Cleans up
 *
 * Requires Node 22+ (has built-in WebSocket).
 */

import http from 'node:http'
import net from 'node:net'
import { createHash } from 'node:crypto'

const ECHO_PORT = 19999
const PROXY_PORT = 19998
const TEST_MSG = 'Arclight WS proxy spike'

// ── WS echo server ─────────────────────────────────────────────────────────

function startEchoServer(port) {
  const server = http.createServer()
  server.on('upgrade', (req, socket) => {
    // Minimal WebSocket handshake accept
    const key = req.headers['sec-websocket-key']
    const accept = createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64')

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    )

    // Echo: read frames, decode, encode back
    let buf = Buffer.alloc(0)
    socket.on('data', (data) => {
      buf = Buffer.concat([buf, data])
      while (buf.length >= 2) {
        const firstByte = buf[0]
        const opcode = firstByte & 0x0F
        const secondByte = buf[1]
        const masked = (secondByte & 0x80) !== 0
        let payloadLen = secondByte & 0x7F
        let offset = 2

        if (payloadLen === 126) {
          if (buf.length < 4) return
          payloadLen = buf.readUInt16BE(2)
          offset = 4
        } else if (payloadLen === 127) {
          if (buf.length < 10) return
          payloadLen = Number(buf.readBigUInt64BE(2))
          offset = 10
        }

        const maskLen = masked ? 4 : 0
        const totalLen = offset + maskLen + payloadLen
        if (buf.length < totalLen) return

        const mask = masked ? buf.subarray(offset, offset + 4) : null
        let payload = buf.subarray(offset + maskLen, offset + maskLen + payloadLen)
        if (mask) {
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4]
          }
        }

        // Close frame
        if (opcode === 0x08) {
          socket.end()
          return
        }

        // Echo back (unmasked, FIN+text)
        if (opcode === 0x01 || opcode === 0x09) {
          const response = Buffer.alloc(2 + payload.length)
          response[0] = 0x81 // FIN + text opcode
          response[1] = payload.length
          payload.copy(response, 2)
          socket.write(response)
        }

        buf = buf.subarray(totalLen)
      }
    })
  })
  server.listen(port)
  return server
}

// ── Proxy server (same approach as web/server/index.mjs WS upgrade) ────────

function startProxy(port, targetPort) {
  const server = http.createServer((_req, res) => {
    res.writeHead(502)
    res.end('Use WebSocket')
  })

  server.on('upgrade', (req, socket, head) => {
    const proxy = net.connect(targetPort, '127.0.0.1', () => {
      const requestHead = [
        `${req.method} ${req.url} HTTP/${req.httpVersion}`,
        ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`),
        '',
        '',
      ].join('\r\n')
      proxy.write(requestHead)
      if (head.length) proxy.write(head)
      proxy.pipe(socket)
      socket.pipe(proxy)
    })
    proxy.on('error', () => socket.destroy())
    socket.on('error', () => proxy.destroy())
  })

  server.listen(port)
  return server
}

// ── Client ─────────────────────────────────────────────────────────────────

async function testProxy() {
  return new Promise((resolve, reject) => {
    const ws = new globalThis.WebSocket(`ws://127.0.0.1:${PROXY_PORT}/ws`)
    const timeout = setTimeout(() => reject(new Error('Timeout')), 5000)

    ws.onopen = () => {
      ws.send(TEST_MSG)
    }

    ws.onmessage = (event) => {
      clearTimeout(timeout)
      const received = event.data
      if (received === TEST_MSG) {
        console.log(`✓ Echo received: "${received}"`)
        ws.close()
        resolve(true)
      } else {
        console.error(`✗ Echo mismatch: "${received}"`)
        ws.close()
        reject(new Error(`Expected "${TEST_MSG}", got "${received}"`))
      }
    }

    ws.onerror = reject
  })
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting WS proxy spike...')
  console.log(`  Echo server → ws://127.0.0.1:${ECHO_PORT}`)
  console.log(`  Proxy       → ws://127.0.0.1:${PROXY_PORT}/ws → :${ECHO_PORT}`)

  const echo = startEchoServer(ECHO_PORT)
  const proxy = startProxy(PROXY_PORT, ECHO_PORT)

  // Wait for servers to start
  await new Promise((r) => setTimeout(r, 200))

  try {
    await testProxy()
    console.log('\n✓ WS proxy spike PASSED')
    process.exitCode = 0
  } catch (err) {
    console.error(`\n✗ WS proxy spike FAILED: ${err.message}`)
    process.exitCode = 1
  } finally {
    proxy.close()
    echo.close()
    // Give sockets time to drain
    await new Promise((r) => setTimeout(r, 300))
    process.exit()
  }
}

main()