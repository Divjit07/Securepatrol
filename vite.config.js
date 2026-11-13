import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  build: {
    // The manifest tells scripts/prerender.mjs which hashed files the static
    // homepage needs.
    manifest: true,
    rollupOptions: {
      // The SPA, plus the tiny script + stylesheet for the prerendered homepage.
      input: {
        app: here('./index.html'),
        home: here('./src/marketing/entry-client.js'),
      },
      output: {
        // Stable vendor chunks: react/supabase hashes survive app-code deploys,
        // so guard phones re-download ~40 kB per release instead of ~460 kB.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
