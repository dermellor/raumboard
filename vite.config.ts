import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ports come from the environment so two instances (self-hosted mode and
// platform mode) can run side by side from one checkout. scripts/dev-web.sh
// loads the instance profile before starting Vite. Defaults are the block base,
// see ~/Development/PORTS.md — port assignment is host setup, not a project
// setting, so a fresh clone works without any of these being set.
const WEB_PORT = Number(process.env.RAUMBOARD_WEB_PORT) || 3210
const API_PORT = Number(process.env.RAUMBOARD_PORT) || 3211
// Where the /api and WebSocket proxy points. Normally the local API server,
// but an instance profile may set a remote URL instead (e.g. the hosted
// production server), so the dev frontend runs against live data without a
// local copy of the database.
const API_TARGET = process.env.RAUMBOARD_API_TARGET || `http://localhost:${API_PORT}`
const REMOTE = API_TARGET.startsWith('https://')

export default defineConfig({
  plugins: [react()],
  server: {
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      // local API server (`npm run dev:api`). changeOrigin stays off: the API
      // resolves the tenant from the Host header, so it has to survive the hop.
      // A remote target is the exception: there the Host must be rewritten to
      // the target's host, which is what selects the tenant on that server.
      '/api': {
        target: API_TARGET,
        ws: true,
        ...(REMOTE && { changeOrigin: true, secure: false }),
      },
    },
  },
})
