import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    open: false,
    watch: {
      ignored: ['**/books/**', '**/node_modules/**', '**/resources/**', '**/index/**']
    }
  },
  optimizeDeps: {
    exclude: ['canvas', 'path2d-polyfill']
  },
  resolve: {
    alias: {
      canvas: false,
      'path2d-polyfill': false
    }
  },
  build: {
    rollupOptions: {
      external: [
        /^books\/.*/,
        /^resources\/.*/,
        /^index\/.*/
      ]
    },
    chunkSizeWarningLimit: 2000
  },
  publicDir: 'public',
  assetsInclude: ['**/*.pdf', '**/*.txt']
});
