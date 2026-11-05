import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }, dedupe: ['react', 'react-dom'] },
  test: {
    include: ['src/lib/localSpokespeople.test.ts', 'src/components/__tests__/BestuurOverzicht.render.tsx'],
    environment: 'node',
    environmentMatchGlobs: [['**/*.render.tsx', 'jsdom']],
  },
});