import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Plain static site: `npm run build` emits dist/ that can be dropped on any host.
// GitHub Pages would additionally need a `base` here.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
