import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    /*
     * TEZLIK (2026-08): kutubxonalarni alohida bo'laklarga
     * ajratamiz.
     *
     * NEGA: React, React Router, socket.io kabi kutubxonalar
     * DEYARLI O'ZGARMAYDI. Ular ilova kodi bilan bitta faylda
     * bo'lsa, har bir kichik kod o'zgarishida foydalanuvchi
     * BUTUN faylni (290+ KB) qaytadan yuklaydi.
     *
     * Alohida bo'lakda esa: ilova kodi o'zgarsa ham kutubxona
     * bo'lagi brauzer keshida qoladi va QAYTA YUKLANMAYDI —
     * keyingi tashriflar ancha tez ochiladi.
     */
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-socket': ['socket.io-client'],
        },
      },
    },
    // Bo'lak hajmi ogohlantirishi — endi bo'laklar kichik
    chunkSizeWarningLimit: 300,
  },
  server: {
    host: '127.0.0.1',   // Windows'da localhost (::1) muammosini oldini oladi
    port: 5174,
    strictPort: true,     // port band bo'lsa boshqasiga o'tmasin — aniq xato bersin
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
