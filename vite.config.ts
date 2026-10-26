import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'apps/studio', base: './', plugins: [react()],
  optimizeDeps: { include: ['monaco-editor/editor/editor.api.js'] },
  server: { host: '127.0.0.1', port: 1420, strictPort: true, fs: { allow: ['../..'] } },
  build: { outDir: '../../dist/studio', emptyOutDir: true },
  worker: { format: 'es' }
});
