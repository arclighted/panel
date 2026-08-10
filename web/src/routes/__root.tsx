import type { ReactNode } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'

import { Toaster } from 'sonner'

import appCss from '../styles.css?url'
import { queryClient } from '../lib/query-client'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Arclight Panel' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="bottom-right" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}