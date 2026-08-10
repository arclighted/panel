import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Box,
  ChartColumnBig,
  Database,
  Folder,
  Key,
  LayoutGrid,
  Network,
  Puzzle,
  Server,
  Settings,
  Users,
} from 'lucide-react'

/**
 * Maps the dash-case icon names used by the panel's server-side icon()
 * helper (src/utils/icon.ts) to lucide-react components for the React shell.
 * Addon-provided icons carry no iconName — their pre-rendered SVG (trusted
 * server HTML) is rendered as-is.
 */
const ICONS: Record<string, LucideIcon> = {
  'layout-grid': LayoutGrid,
  server: Server,
  users: Users,
  network: Network,
  activity: Activity,
  box: Box,
  puzzle: Puzzle,
  key: Key,
  settings: Settings,
  'chart-column': ChartColumnBig,
  database: Database,
}

export function NavIcon({
  iconName,
  iconHtml,
  className,
}: {
  iconName: string | null
  iconHtml?: string
  className?: string
}) {
  const Cmp = iconName ? ICONS[iconName] : undefined
  if (Cmp) return <Cmp className={className} aria-hidden />
  if (iconHtml) {
    return (
      <span className={className} aria-hidden dangerouslySetInnerHTML={{ __html: iconHtml }} />
    )
  }
  return <Folder className={className} aria-hidden />
}
