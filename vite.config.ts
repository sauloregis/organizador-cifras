import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' faz o app funcionar em qualquer hospedagem estática
// (GitHub Pages, Netlify, Vercel, Cloudflare Pages...) sem configuração extra.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0') },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Cifras Louvor',
        short_name: 'Cifras',
        description: 'Cifras e repertórios do grupo de louvor — funciona offline',
        lang: 'pt-BR',
        theme_color: '#14161c',
        background_color: '#14161c',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        // o leitor de PDF (pdf.js) é grande; precisa caber no cache offline
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
