import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '127.0.0.1',   // Windows'da localhost (::1) muammosini oldini oladi
    port: 5174,
    strictPort: true,     // port band bo'lsa boshqasiga o'tmasin — aniq xato bersin
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
