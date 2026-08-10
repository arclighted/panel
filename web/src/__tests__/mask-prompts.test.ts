import { describe, it, expect } from 'vitest'

import { maskPrompts } from '../components/server/terminal'

describe('maskPrompts (ported from manage.ejs)', () => {
  it('passes through plain server output', () => {
    expect(maskPrompts('Hello from the server!')).toBe('Hello from the server!')
  })

  it('replaces a bare container prompt', () => {
    expect(maskPrompts('container@hostname:~$')).toBe('\r\narclightd~ ')
  })

  it('replaces root prompts', () => {
    expect(maskPrompts('root@server-1:/#')).toBe('\r\narclightd~ ')
  })

  it('handles ANSI-coloured prompts by stripping escapes first', () => {
    const raw = '\r\x1b[01;32mcontainer@petrodactyl\x1b[00m:\x1b[01;34m~\x1b[00m$ '
    expect(maskPrompts(raw)).toBe('\r\narclightd~ ')
  })

  it('replaces prompts inside mixed chunks without losing the rest', () => {
    const raw = 'container@host:~$ echo hi'
    expect(maskPrompts(raw)).toBe('arclightd~ echo hi')
  })
})
