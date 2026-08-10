import type { ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'
import { LogOut, Moon, MoreHorizontal, Sun, User as UserIcon } from 'lucide-react'
import { useState } from 'react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { NavIcon } from '@/components/shell/nav-icon'
import { useTheme } from '@/components/shell/use-theme'
import type { AuthSettings, SessionUser } from '@/lib/auth-config'
import { useDashboard, type NavItem } from '@/lib/dashboard'
import { cn } from '@/lib/utils'

function avatarSrc(user: SessionUser): string {
  return user.avatar ?? `/avatar/${encodeURIComponent(user.username ?? 'unknown')}`
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix)
  if (item.url === '/') return pathname === '/'
  return pathname === item.url || pathname.startsWith(`${item.url}/`)
}

function NavLinkItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const active = isItemActive(item, pathname)
  // Nav items point at the legacy Express pages (and addon routes) which are
  // proxied — plain anchors give identical behavior to the EJS shell.
  return (
    <a
      href={item.url}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-2 text-sm transition-colors',
        active
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <NavIcon iconName={item.iconName} iconHtml={item.icon} className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </a>
  )
}

function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

function BrandLogo({
  settings,
  className,
}: {
  settings: AuthSettings
  className?: string
}) {
  return (
    <a href="/" className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {settings.logo ? (
        <img
          src={settings.logo}
          alt={`${settings.title} logo`}
          className="size-8 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          {settings.title.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="truncate text-sm font-medium">{settings.title}</span>
    </a>
  )
}

export function AppShell({
  user,
  settings,
  children,
}: {
  user: SessionUser
  settings: AuthSettings
  children: ReactNode
}) {
  const pathname = useLocation().pathname
  const [moreOpen, setMoreOpen] = useState(false)
  // Shared with the dashboard page (same query key → single fetch). The nav
  // items are server-driven (uiComponentStore, incl. addons).
  const dashboard = useDashboard(1, true)
  const nav = dashboard.data?.nav
  const regular = nav?.regular ?? []
  const adminGroups = nav?.adminGroups ?? []

  return (
    <div className="min-h-dvh">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b px-4">
          <BrandLogo settings={settings} />
        </div>

        <a
          href="/account"
          className="mx-3 my-3 flex shrink-0 items-center gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-accent/50"
        >
          <img
            src={avatarSrc(user)}
            alt=""
            className="size-8 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.username ?? user.email}
              <sup className="ml-1 text-muted-foreground">
                #{String(user.id).padStart(4, '0')}
              </sup>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.description || user.email}
            </p>
          </div>
        </a>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {regular.length === 0 ? (
            <NavLinkItem
              item={{
                id: 'servers',
                label: 'Dashboard',
                url: '/',
                iconName: 'layout-grid',
                matchPrefix: '/server',
              }}
              pathname={pathname}
            />
          ) : (
            regular.map((item) => (
              <NavLinkItem key={item.id} item={item} pathname={pathname} />
            ))
          )}

          {user.isAdmin && adminGroups.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="px-4 pb-1 text-xs font-medium text-muted-foreground">
                Admin Panel
              </p>
              {adminGroups.map((group) => (
                <div key={group.section}>
                  <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <NavLinkItem key={item.id} item={item} pathname={pathname} />
                  ))}
                </div>
              ))}
            </>
          )}
        </nav>

        <div className="border-t p-3">
          <a
            href="/logout"
            className="flex items-center gap-3 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </a>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
        <BrandLogo settings={settings} />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <a
            href="/account"
            aria-label="Account"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <img
              src={avatarSrc(user)}
              alt=""
              className="size-6 rounded-lg object-cover"
            />
          </a>
        </div>
      </header>

      {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t bg-background px-2 lg:hidden"
      >
        {regular.slice(0, 4).map((item) => (
          <a
            key={item.id}
            href={item.url}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
              isItemActive(item, pathname)
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
          >
            <NavIcon
              iconName={item.iconName}
              iconHtml={item.icon}
              className="size-5 shrink-0"
            />
            <span className="max-w-16 truncate">{item.label}</span>
          </a>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="More navigation options"
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors"
              />
            }
          >
            <MoreHorizontal className="size-5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[min(70vh,560px)]">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 overflow-y-auto px-1 py-4">
              {regular.slice(4).map((item) => (
                <NavLinkItem
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMoreOpen(false)}
                />
              ))}
              {adminGroups.map((group) => (
                <div key={group.section}>
                  <p className="px-4 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <NavLinkItem
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      onNavigate={() => setMoreOpen(false)}
                    />
                  ))}
                </div>
              ))}
              <Separator className="my-2" />
              <a
                href="/account"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <UserIcon className="size-4 shrink-0" />
                Account
              </a>
              <a
                href="/logout"
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-accent"
              >
                <LogOut className="size-4 shrink-0" />
                Sign out
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="pb-20 lg:pb-0 lg:pl-60">
        <div className="px-4 pb-10 pt-6 sm:px-8">{children}</div>
      </main>
    </div>
  )
}
