import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { Card } from '@/components/ui/card'
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
    <div className="flex min-h-dvh bg-background">
      {/* Form panel */}
      <div className={cn(
        'flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16',
        className,
      )}>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            {settings.logo ? (
              <img
                src={settings.logo}
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

          <Card className="p-6">{children}</Card>

          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>

      {/* Wallpaper panel (hidden on small screens) */}
      <div
        aria-hidden
        className="hidden lg:block lg:w-1/2"
        style={{
          backgroundImage: `url('${bg}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
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