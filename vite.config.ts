import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // アプリ全体を Cloudflare Access で保護しているため、manifest の取得にもログインの Cookie を付ける
      useCredentials: true,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,ico,png}'],
        // API と音声は Worker が返す。Service Worker が index.html にすり替えないようにする
        navigateFallbackDenylist: [/^\/api\//, /^\/audio\//],
      },
      manifest: {
        name: '穴埋め問題集 - 不動産鑑定評価基準',
        short_name: '穴埋め問題集',
        description: '不動産鑑定評価基準の穴埋め問題で学習するアプリ',
        start_url: '/',
        display: 'standalone',
        background_color: '#667eea',
        theme_color: '#667eea',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
