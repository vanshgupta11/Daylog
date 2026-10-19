import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to Express during dev
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Proxy tracker app
      '/tracker': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
