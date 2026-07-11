import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
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
