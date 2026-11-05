import { defineConfig, mergeConfig } from 'vitest/config';
import componentConfig from './vitest.components.config';

export default mergeConfig(componentConfig, defineConfig({
  test: { include: ['src/lib/localSpokespeople.test.ts', 'src/components/__tests__/BestuurOverzicht.render.tsx'] },
}));