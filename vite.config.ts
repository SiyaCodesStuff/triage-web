import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { scriptCsp } from './build/script-csp.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBasePath = env.VITE_API_BASE_PATH || '/api/v1';

  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(apiBasePath)) {
    throw new Error(
      'VITE_API_BASE_PATH must be a path such as /api/v1, without a trailing slash.',
    );
  }

  return {
    plugins: [react(), tailwindcss(), scriptCsp()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        [`^${apiBasePath}(?:/|$|\\?)`]: {
          target: process.env.E2E_API_ORIGIN || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      maxWorkers: 2,
      testTimeout: 10_000,
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.d.ts',
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          // Type-only adapters over the generated API schema have no executable lines.
          'src/api/types.ts',
          // Generated shadcn UI primitives are outside application coverage.
          'src/components/ui/**',
        ],
        reporter: [
          ['text', { maxCols: 180, skipFull: false }],
          'html',
          'json-summary',
        ],
        thresholds: { lines: 80 },
      },
    },
  };
});
