import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: process.cwd(),
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  build: {
    outDir: 'dist-buddy',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'buddy.html'),
    },
    target: 'esnext',
  },
});
