import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

/**
 * Entry points are left to electron-vite's defaults:
 *   main    src/main/index.ts    -> out/main/index.cjs
 *   preload src/preload/index.ts -> out/preload/index.cjs
 *   renderer src/renderer/index.html
 *
 * The `.cjs` extensions are deliberate. The root package.json is
 * `"type": "module"` so that Node's test runner and tsc both read the sources
 * as ES modules, but a sandboxed preload cannot be an ES module, so main and
 * preload are emitted as CommonJS instead. Naming them `.cjs` keeps them
 * CommonJS regardless of the package type.
 */
export default defineConfig({
  main: {
    build: {
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  preload: {
    build: {
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  renderer: {
    build: {
      // electron-vite leaves output unminified by default, which suits the main
      // and preload processes (readable stack traces) but not the renderer.
      minify: 'esbuild',
    },
    plugins: [react(), tailwindcss()],
  },
})
