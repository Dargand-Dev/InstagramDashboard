import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { backendRestartPlugin } from './dev/backendRestart.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Bouton « Redémarrer » de /settings (serveur de dev uniquement)
      backendRestartPlugin({
        backendDir: env.BACKEND_DIR || path.resolve(__dirname, '../InstagramAutomation'),
        port: Number(env.BACKEND_PORT) || 8081,
        startCommand: env.BACKEND_START_CMD || 'mvn spring-boot:run',
      }),
    ],
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
          // Le hop proxy est serveur -> serveur : l'Origin du navigateur
          // (http://localhost:5173) n'a plus de sens cote Scraper. Or Vite le
          // reforwarde tel quel (changeOrigin ne reecrit que Host), et Spring
          // Security rejette alors la requete en 403 "Invalid CORS request"
          // avant meme l'authentification, puisque CORS_ALLOWED_ORIGINS ne
          // contient que l'origine de prod. On le supprime : le backend voit
          // une requete same-origin, comme prevu par SecurityConfig.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
            })
          },
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
