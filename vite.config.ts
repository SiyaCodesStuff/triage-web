import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBasePath = env.VITE_API_BASE_PATH || '/api/v1';

  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(apiBasePath)) {
    throw new Error(
      'VITE_API_BASE_PATH must be a path such as /api/v1, without a trailing slash.',
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        [`^${apiBasePath}(?:/|$|\\?)`]: {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      maxWorkers: 2,
      testTimeout: 10_000,
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
    },
  };
});
