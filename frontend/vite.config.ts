import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Lune Journal',
        short_name: 'Lune',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF5EE',
        theme_color: '#FFF5EE',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:8000', '/media': 'http://localhost:8000' },
  },
  // `vite preview` nutzt server.proxy nicht — der Browser-Test laeuft gegen die
  // gebaute App und braucht denselben Durchstich zum Backend.
  preview: {
    proxy: { '/api': 'http://localhost:8000', '/media': 'http://localhost:8000' },
  },
})
