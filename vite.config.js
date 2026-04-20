import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  return {
    plugins: [react(), tailwindcss()],
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts: true,
      proxy: {
        '/api/scraper': {
          target: env.VITE_SCRAPER_URL || 'http://localhost:8082',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/scraper/, ''),
        },
        '/api': 'http://localhost:8081',
        '/ws': {
          target: 'http://localhost:8081',
          ws: true,
        },
      },
    },
  }
})
