import { Fragment } from 'react'

import { useAddonSlotComponents } from '@/lib/addon-v3/registry'

export interface AddonSlotProps {
  /** The named mount point, e.g. `server:console:toolbar`. */
  slot: string
  /** Props forwarded to each mounted addon component. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any
}

/**
 * Renders every addon component registered for a named slot, in manifest order.
 *
 * Usage:
 *   <AddonSlot slot="server:console:toolbar" uuid={server.uuid} />
 *
 * If no addon registers the slot, renders nothing (fragment), so slots are
 * safe to mount unconditionally in the shell.
 */
export function AddonSlot({ slot, ...rest }: AddonSlotProps) {
  const components = useAddonSlotComponents(slot)

  if (components.length === 0) return null

  return (
    <Fragment>
      {components.map(({ slug, component: Component }) => (
        // eslint-disable-next-line react/jsx-key
        <Component key={slug} {...rest} />
      ))}
    </Fragment>
  )
}
