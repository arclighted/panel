import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/**
 * Builds @arclight/ui as a browser ESM bundle for addon v3 consumers.
 *
 * The panel app itself owns `react`, `react-dom`, the router, and the query
 * client — addon bundles import those as bare specifiers and the panel's
 * import map resolves them to the single app copies (never duplicate React).
 * Everything else (base-ui, lucide icons, sonner, cn) is bundled in.
 */
export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      // base-ui imports use-sync-external-store/shim and
      // use-sync-external-store/shim/with-selector (CJS with a runtime
      // require("react")). Alias both to our ESM shim so the CJS shim never
      // reaches the bundle (it throws in browser ESM when react is external).
      {
        find: /^use-sync-external-store\/shim(?:\/with-selector)?$/,
        replacement: fileURLToPath(
          new URL("./src/vendor/use-sync-external-store.ts", import.meta.url),
        ),
      },
    ],
  },
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: "index",
      cssFileName: "index",
    },
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        // react/jsx-dev-runtime MUST also be external: without it, rolldown
        // tries to bundle the CJS jsxDEV runtime, which emits a runtime
        // `require("react")` shim that throws in browser ESM. The import map
        // serves jsxDEV from /vendor/react.mjs (vendored in vendor-v3.mjs).
        "react/jsx-dev-runtime",
        "@tanstack/react-router",
        "@tanstack/react-query",
      ],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
