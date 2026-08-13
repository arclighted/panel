import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { AuthSettings } from '@/lib/auth-config'

export const DEFAULT_WALLPAPER = '/assets/wallpapers/login.jpeg'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  settings: AuthSettings
  /** Wallpaper path override (register uses its own). */
  wallpaper?: string | null
  error?: string | null
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AuthLayout({
  title,
  subtitle,
  settings,
  wallpaper,
  error,
  children,
  footer,
  className,
}: AuthLayoutProps) {
  const bg = wallpaper ?? settings.loginWallpaper ?? DEFAULT_WALLPAPER

  return (
    /*
     * Express auth split: a fixed 420px form panel on --theme-bg-card with a
     * right border, wallpaper filling the rest. On mobile the wallpaper sits
     * behind a translucent panel (legacy .auth-split/.auth-panel/.auth-image).
     */
    <div className="relative flex min-h-dvh bg-background">
      {/* Wallpaper */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 md:static md:z-auto md:flex-1"
        style={{
          backgroundImage: `url('${bg}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Form panel */}
      <div
        className={cn(
          'relative z-10 flex min-h-dvh w-full flex-col justify-center',
          'bg-[color-mix(in_srgb,var(--theme-bg-card)_95%,transparent)]',
          'px-6 py-12 sm:px-10',
          'md:z-auto md:min-h-0 md:w-auto md:max-w-[420px] md:shrink-0',
          'md:border-r md:border-border md:bg-card',
          className,
        )}
      >
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            {settings.logo ? (
              <img
                src={settings.logo.startsWith('/') ? settings.logo : `/${settings.logo}`}
                alt={`${settings.title} logo`}
                className="mb-5 h-10 w-10 rounded-xl object-contain"
              />
            ) : null}
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>

          {error ? (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {children}

          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

export function AuthBackLink({ to = '/login', label = 'Back to sign in' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="text-sm font-medium text-primary hover:underline">
      {label}
    </Link>
  )
}
