import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone renderer preview (browser only, no Electron). Used to visually
// verify the UI. The real app runs via electron.vite.config.ts.
export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: { '@renderer': resolve(__dirname, 'src/renderer/src') }
  },
  plugins: [react(), tailwindcss()],
  server: { port: 5178 }
})
