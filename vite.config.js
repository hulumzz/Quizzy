import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL?.replace(/\/$/, '')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: mode === 'network' ? '0.0.0.0' : undefined,
      allowedHosts: mode === 'network' ? ['.trycloudflare.com'] : undefined,
      proxy: apiTarget ? {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      } : undefined,
    },
  }
})
