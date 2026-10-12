import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The renderer is now the whole app: a static build deployable to any static
 * host. `base: './'` keeps asset URLs relative, so the same dist/ works at a
 * domain root and in a GitHub Pages subpath alike.
 *
 * `envDir` points at the repo root because `root` itself is src/renderer —
 * .env files (the OAuth client ID and proxy URL) live beside this file.
 */
export default defineConfig({
  root: 'src/renderer',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
})
