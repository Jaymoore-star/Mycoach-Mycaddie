import { defineConfig } from 'vitest/config';

/**
 * Tests cover the pure logic in `convex/lib` — curriculum, caddie, courses,
 * handicap. That is where the app's golf rules live, and it runs identically
 * on the server and the client.
 *
 * Convex function modules are not covered here: they need `convex-test` to
 * mock auth and the database. Worth adding, but the rules are the higher risk.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
