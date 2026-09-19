/**
 * Getting the real message out of whatever a Convex call threw.
 *
 * A `ConvexError` raised on the server does not arrive as an `Error` - it
 * crosses the wire as `{ data: { message, code } }` - so the obvious
 * `e instanceof Error ? e.message : fallback` silently drops exactly the
 * errors the server went to the trouble of describing.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message) return data.message;
  }
  return fallback;
}
