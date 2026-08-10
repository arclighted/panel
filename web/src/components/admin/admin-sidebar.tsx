import { useLocation } from '@tanstack/react-router'
import type { AdminSidebarGroup } from '@/lib/admin'
import { cn } from '@/lib/utils'

/**
 * Addon-driven admin navigation rail (same source as the EJS template:
 * uiComponentStore.getAdminSidebarGroups()). Grouped into sections; the active
 * item is highlighted from the current pathname. Links are plain anchors
 * because addon-supplied URLs are dynamic strings, not typed routes.
 */
export function AdminSidebar({ groups }: { groups: AdminSidebarGroup[] }) {
  const { pathname } = useLocation()

  const isActive = (url: string) =>
    pathname === url || (url !== '/' && pathname.startsWith(`${url}/`))

  return (
    <nav
      aria-label="Admin sections"
      className="sticky top-20 hidden h-fit w-52 shrink-0 flex-col gap-5 lg:flex"
    >
      {groups.map((group) => (
        <div key={group.section}>
          <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.url)
              return (
                <a
                  key={item.id}
                  href={item.url}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <NavIcon svg={item.icon} />
                  <span className="truncate">{item.label}</span>
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

/** Mobile: horizontal scrollable row of the same items. */
export function AdminSidebarMobile({ groups }: { groups: AdminSidebarGroup[] }) {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Admin sections"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:hidden"
    >
      {groups.flatMap((group) =>
        group.items.map((item) => {
          const active = pathname === item.url || pathname.startsWith(`${item.url}/`)
          return (
            <a
              key={item.id}
              href={item.url}
              className={cn(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'border-transparent bg-accent font-medium text-accent-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <NavIcon svg={item.icon} />
              {item.label}
            </a>
          )
        }),
      )}
    </nav>
  )
}

/** Sidebar icons are raw SVG strings (same trust model as the EJS sidebar). */
function NavIcon({ svg }: { svg: string }) {
  if (!svg) return null
  return (
    <span
      className="size-4 shrink-0 [&>svg]:size-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
