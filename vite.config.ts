import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Port block 3210–3219, see ~/Development/PORTS.md
    port: 3210,
    strictPort: true,
    proxy: {
      // local API server (`npm run dev:api`)
      '/api': {
        target: 'http://localhost:3211',
        ws: true,
      },
    },
  },
})
