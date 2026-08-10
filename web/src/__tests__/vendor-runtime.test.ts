import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// Load the vendored runtime through raw node ESM (bypasses Vite's /public
// module guard) so this canary validates the actual built files.
const reactMod = await import(
  pathToFileURL(resolve(process.cwd(), 'public/vendor/react.mjs')).href,
)
const { jsx, Fragment, useState } = reactMod
const { createRoot } = reactMod

/**
 * Canary for the addon v3 vendor runtime (web/public/vendor/*.mjs).
 *
 * If esbuild had inlined a second React into react-dom-client.mjs, mounting a
 * component that uses hooks from react.mjs through that react-dom would throw
 * "Invalid hook call". This test exists to catch exactly that regression, so
 * the import-map runtime keeps ONE React instance across app + addon bundles.
 */
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('vendor runtime (react + react-dom single instance)', () => {
  it('renders a hooks component through the vendored react-dom', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    function Counter() {
      const [count, setCount] = useState(0)
      return jsx('button', { onClick: () => setCount((n: number) => n + 1), children: `count:${count}` })
    }

    const root = createRoot(container)
    root.render(jsx(Counter, {}))
    await flush()
    expect(container.textContent).toContain('count:0')

    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(container.textContent).toContain('count:1')

    root.unmount()
    container.remove()
  })

  it('exports the jsx-runtime API from react.mjs (import-map key react/jsx-runtime)', () => {
    expect(typeof jsx).toBe('function')
    expect(Fragment).toBeDefined()
    expect(typeof useState).toBe('function')
  })
})
