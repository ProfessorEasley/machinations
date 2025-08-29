<<<<<<< HEAD
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

=======
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
// const dirname =
//   typeof __dirname !== 'undefined'
//     ? __dirname
//     : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
    },
  },
<<<<<<< HEAD
=======
  // test: {
  //   include: [
  //     //   'src/core/__tests__/**/*.test.ts',
  //     //   'src/core/__tests__/*.test.ts',
  //     //   'src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  //     // ],
  //     // setupFiles: ['.storybook/vitest.setup.ts'],
  //     // browser: {
  //     //   enabled: true,
  //     //   headless: true,
  //     //   provider: 'playwright',
  //     //   instances: [
  //     //     {
  //     //       browser: 'chromium',
  //     //     },
  //     //   ],
  //     // },
  //     // plugins: [
  //     //   storybookTest({
  //     //     configDir: path.join(dirname, '.storybook'),
  //     //   }),
  //     'src/core/__tests__/*.test.ts',
  //   ],
  // },
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8
});
