/**
 * Raw bytes to base64, without a dependency.
 *
 * The realtime transcription socket takes PCM as base64, and this runs on
 * every microphone buffer - roughly ten times a second while the golfer is
 * speaking. React Native has no `Buffer`, and `btoa` is not reliably present
 * across the runtimes this app ships on, so the twenty lines are worth more
 * than a polyfill.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';

  // Three bytes become four characters. The tail is handled after the loop so
  // the hot path has no per-iteration branch.
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const triple = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      ALPHABET[(triple >> 18) & 63] +
      ALPHABET[(triple >> 12) & 63] +
      ALPHABET[(triple >> 6) & 63] +
      ALPHABET[triple & 63];
  }

  const left = bytes.length - i;
  if (left === 1) {
    const chunk = bytes[i] << 16;
    out += ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63] + '==';
  } else if (left === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      ALPHABET[(chunk >> 18) & 63] +
      ALPHABET[(chunk >> 12) & 63] +
      ALPHABET[(chunk >> 6) & 63] +
      '=';
  }

  return out;
}
