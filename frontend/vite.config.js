import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/system': {
        target: 'http://localhost/murg',
        changeOrigin: true,
        cookiePathRewrite: { '*': '/' },
      },
      '/sub': {
        target: 'http://localhost/murg',
        changeOrigin: true,
        cookiePathRewrite: { '*': '/' },
      },
      '/assets': {
        target: 'http://localhost/murg',
        changeOrigin: true,
      },
      '/bootstrap': {
        target: 'http://localhost/murg',
        changeOrigin: true,
      },
      '/plugins': {
        target: 'http://localhost/murg',
        changeOrigin: true,
      },
      '/auth_bridge.php': {
        target: 'http://localhost/murg',
        changeOrigin: true,
        cookiePathRewrite: { '*': '/' },
      },
      '/auth_bridge': {
        target: 'http://localhost/murg',
        changeOrigin: true,
        cookiePathRewrite: { '*': '/' },
      },
      '/murg': {
        target: 'http://localhost',
        changeOrigin: true,
        cookiePathRewrite: { '*': '/' },
      },
    },
  },
})
