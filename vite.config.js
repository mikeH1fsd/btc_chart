import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/btc_chart/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.frankfurter.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo/, ''),
      },
    },
  },
})
