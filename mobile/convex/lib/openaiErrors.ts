/**
 * OpenAI's "too many tokens this minute", however it arrives.
 *
 * The AI SDK wraps it as an `APICallError` with `statusCode: 429`; a raw fetch
 * surfaces it as a status on the response and "Rate limit reached for..." in
 * the body. Every path that falls back to a cheaper model, or tells the golfer
 * to wait, has to recognise all of them.
 */
export function isRateLimited(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const e = error as { statusCode?: unknown; status?: unknown };
    if (e.statusCode === 429 || e.status === 429) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /rate limit|\b429\b|too many requests/i.test(message);
}
