import { defineConfig } from 'vitest/config'

// Vitest 4 defaults to the oxc transform, which does not support decorators.
// The host runtime uses standard decorators (@Remote — they require the
// standard `addInitializer` semantics), so oxc must be disabled and the
// esbuild transform used instead; target es2022 forces esbuild to transpile
// standard decorators into plain JS helpers the test runtime can parse.
export default defineConfig({
  oxc: false,
  esbuild: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/client/**', 'src/invariant.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
} as Parameters<typeof defineConfig>[0] & { oxc: false })
