import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/BackgroundJob': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/BackgroundJobHub': {
        target: 'http://localhost:5000',
        ws: true,
      }
    },
  },
  build: {
    outDir: 'build',
    assetsDir: 'static',
    sourcemap: false,
    // Increase chunk size warning limit for larger bundles like xlsx
    chunkSizeWarningLimit: 2000,
  },
});
