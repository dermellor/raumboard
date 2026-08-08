import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ports come from the environment so two instances (self-hosted mode and
// platform mode) can run side by side from one checkout. scripts/dev-web.sh
// loads the instance profile before starting Vite. Defaults are the block base,
// see ~/Development/PORTS.md — port assignment is host setup, not a project
// setting, so a fresh clone works without any of these being set.
const WEB_PORT = Number(process.env.RAUMBOARD_WEB_PORT) || 3210
const API_PORT = Number(process.env.RAUMBOARD_PORT) || 3211

export default defineConfig({
  plugins: [react()],
  server: {
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      // local API server (`npm run dev:api`). changeOrigin stays off: the API
      // resolves the tenant from the Host header, so it has to survive the hop.
      '/api': {
        target: `http://localhost:${API_PORT}`,
        ws: true,
      },
    },
  },
})
