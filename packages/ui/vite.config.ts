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
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
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
        "@tanstack/react-router",
        "@tanstack/react-query",
      ],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
