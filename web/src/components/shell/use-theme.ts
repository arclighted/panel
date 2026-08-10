import { useCallback, useEffect, useState } from 'react'

/**
 * Lightweight dark-mode hook matching the legacy panel behavior:
 * localStorage 'theme' wins, otherwise the system preference. The `dark`
 * class on <html> drives shadcn/Tailwind v4 dark variants. Applied in an
 * effect (never during render) so SSR HTML stays hydration-stable.
 */
export function useTheme() {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const initial = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(initial)
    document.documentElement.classList.toggle('dark', initial)
  }, [])

  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !(d ?? false)
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  return { dark, toggle }
}
