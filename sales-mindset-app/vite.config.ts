import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot('.'), '..'],
    },
  },
  build: {
    outDir: '../sales-mindset',
    emptyOutDir: true,
    sourcemap: false,
  },
});
