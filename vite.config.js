import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // When running `netlify dev`, Netlify proxies Vite on port 8888 and
    // serves /api/* via the functions runtime — no Vite proxy needed.
    // This proxy is only used if you run `npm run dev` standalone alongside
    // a separately-running `netlify functions:serve` on port 9999.
    proxy: {
      '/api': {
        target: 'http://localhost:9999',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
