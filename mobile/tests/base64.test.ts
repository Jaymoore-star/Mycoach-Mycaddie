import { describe, expect, it } from 'vitest';

import { encodeBase64 } from '../src/lib/base64';

/** Node's own encoder, as the thing to agree with. */
function reference(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

function encode(bytes: number[]): string {
  return encodeBase64(new Uint8Array(bytes).buffer);
}

describe('encodeBase64', () => {
  it('matches a known encoder on plain text', () => {
    const bytes = [...Buffer.from('seven iron, one forty five')];
    expect(encode(bytes)).toBe(reference(bytes));
  });

  it('pads every remainder correctly', () => {
    // The tail is the only part with branches, and a wrong pad corrupts the
    // end of every audio frame - silently, because the socket still accepts it.
    for (let length = 0; length <= 16; length++) {
      const bytes = Array.from({ length }, (_, i) => (i * 37) % 256);
      expect(encode(bytes), `length ${length}`).toBe(reference(bytes));
    }
  });

  it('handles the whole byte range, including the high bit', () => {
    // PCM16 is signed and little-endian, so half of every sample has the top
    // bit set. A sign-extension bug here would be inaudible in testing and
    // wreck the audio in practice.
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    expect(encode(bytes)).toBe(reference(bytes));
  });

  it('returns an empty string for an empty buffer', () => {
    expect(encode([])).toBe('');
  });

  it('agrees with the reference on a realistic PCM frame', () => {
    // A tenth of a second of 24kHz mono PCM16 is what actually arrives.
    const samples = new Int16Array(2400);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.round(Math.sin(i / 12) * 32767);
    }
    const bytes = [...new Uint8Array(samples.buffer)];

    expect(encodeBase64(samples.buffer)).toBe(reference(bytes));
  });

  it('emits only base64 characters', () => {
    const bytes = Array.from({ length: 300 }, (_, i) => (i * 101) % 256);
    expect(encode(bytes)).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
  });
});
