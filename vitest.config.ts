import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // scripts/ is included because the coordination tooling in there is part of
    // this project's correctness story, not incidental build glue:
    // session-bridge.mjs is how two concurrent sessions avoid editing the same
    // file, and it produced five separate pool/claim bugs in one session, every
    // one found by hand because there was no way to run it twice in a test. Its
    // suite lives at scripts/sessionBridge.test.js.
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.{js,mjs,cjs}'],
    exclude: ['node_modules', 'dist', 'android'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '**/*.d.ts', 'vitest.setup.ts'],
    },
  },
});