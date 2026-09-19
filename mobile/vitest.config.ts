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
    /**
     * Vitest's default is 5s, which the coach-chat tests flake against when the
     * whole suite runs at once: the first of them pays for registering the
     * `@convex-dev/agent` component into a cold in-memory deployment, which is
     * comfortably under a second on its own and several times that when it is
     * competing with every other file. A release gate that fails at random is
     * worse than a slow one.
     */
    testTimeout: 20_000,
  },
});
