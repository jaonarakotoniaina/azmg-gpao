import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Application de pilotage (React). Le serveur Express sert le resultat de dist/web en production.
export default defineConfig({
  root: 'src/web',
  publicDir: path.resolve(__dirname, 'src/web/public'),
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
  build: { outDir: path.resolve(__dirname, 'dist/web'), emptyOutDir: true, sourcemap: false },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/fichiers': 'http://localhost:3000',
      '/public': 'http://localhost:3000',
    },
  },
});
