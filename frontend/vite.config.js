import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!/\/src\/.*\.js$/.test(id)) {
          return null;
        }

        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic'
        });
      }
    },
    react()
  ],
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8080',
      '/metrics': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js'
  }
});
