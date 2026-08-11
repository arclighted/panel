import type { ReactNode } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'

import { Toaster } from 'sonner'

import appCss from '../styles.css?url'
import { queryClient } from '../lib/query-client'
import { CsrfMeta } from '../components/csrf-meta'

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

const VENDOR_IMPORT_MAP = JSON.stringify({
  imports: import.meta.env.DEV
    ? {
        react: '/src/lib/addon-v3/runtime/react.js',
        'react/jsx-runtime': '/src/lib/addon-v3/runtime/react-jsx-runtime.ts',
        'react/jsx-dev-runtime': '/src/lib/addon-v3/runtime/react-jsx-dev-runtime.ts',
        'react-dom': '/src/lib/addon-v3/runtime/react-dom.ts',
        'react-dom/client': '/src/lib/addon-v3/runtime/react-dom-client.ts',
        '@tanstack/react-router': '/src/lib/addon-v3/runtime/react-router.ts',
        '@tanstack/react-query': '/src/lib/addon-v3/runtime/react-query.ts',
        '@arclight/ui': '/arclight-ui/index.js',
      }
    : {
        react: '/vendor/react.mjs',
        'react/jsx-runtime': '/vendor/react.mjs',
        'react/jsx-dev-runtime': '/vendor/react.mjs',
        'react-dom': '/vendor/react.mjs',
        'react-dom/client': '/vendor/react.mjs',
        '@tanstack/react-router': '/vendor/react-router.mjs',
        '@tanstack/react-query': '/vendor/react-query.mjs',
        '@arclight/ui': '/arclight-ui/index.js',
      },
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Addon v3 import map: addon bundles externalize the shared runtime
          (react, react-dom, router, query) and the browser resolves those bare
          specifiers here — to web/public/vendor/*.mjs (built by
          web/scripts/vendor-v3.mjs). Because the app build externalizes the
          same specifiers (vite.config rollupOptions.external), the APP's own
          chunks also resolve here, guaranteeing a SINGLE React instance across
          the app and every addon bundle.
        */}
        <script type="importmap" dangerouslySetInnerHTML={{ __html: VENDOR_IMPORT_MAP }} />
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <QueryClientProvider client={queryClient}>
          <CsrfMeta />
          {children}
          <Toaster richColors position="bottom-right" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
