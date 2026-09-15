import { defineConfig } from 'vitest/config';

/**
 * Two kinds of test live in `tests/`.
 *
 * The `*.test.ts` files cover the pure logic in `convex/lib` - curriculum,
 * caddie, courses, handicap, voice. That is where the app's golf rules live,
 * and it runs identically on the server and the client.
 *
 * The `*.functions.test.ts` files run the Convex functions themselves against
 * `convex-test`'s in-memory database, which is the only way to cover the
 * ownership checks and the server-side gates - the rules a modified client
 * would otherwise walk straight through. They need the edge runtime, declared
 * per file with `// @vitest-environment edge-runtime` so the pure-logic tests
 * keep the faster node environment.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
