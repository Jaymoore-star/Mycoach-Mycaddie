import { describe, expect, it } from 'vitest';

import { splitBold, stripMarkdown, toLines } from '../convex/lib/markdown';

/** The shape a coaching reply actually arrives in. */
const REPLY = `Absolutely, Jeet. Let's break it down simply.

1. **Grip**: Hold the club so that the "V" shape points to your right shoulder.

2. **Alignment**: Stand so that your feet, hips, and shoulders are all aiming straight.

This will help you hit straighter shots.`;

describe('stripMarkdown', () => {
  it('keeps the words and drops the markers', () => {
    const spoken = stripMarkdown(REPLY);

    // Every one of these is audible when synthesised.
    expect(spoken).not.toContain('*');
    expect(spoken).toContain('Grip');
    expect(spoken).toContain('Alignment');
    expect(spoken).toContain('straighter shots');
  });

  it('unwraps every emphasis style a model reaches for', () => {
    expect(stripMarkdown('**bold**')).toBe('bold');
    expect(stripMarkdown('__bold__')).toBe('bold');
    expect(stripMarkdown('*italic*')).toBe('italic');
    expect(stripMarkdown('_italic_')).toBe('italic');
    expect(stripMarkdown('`code`')).toBe('code');
  });

  it('removes headings, bullets and quote markers', () => {
    expect(stripMarkdown('## Setup')).toBe('Setup');
    expect(stripMarkdown('- one\n- two')).toBe('one\ntwo');
    expect(stripMarkdown('* one\n+ two')).toBe('one\ntwo');
    expect(stripMarkdown('> a quote')).toBe('a quote');
  });

  it('keeps a link text and drops its target', () => {
    expect(stripMarkdown('see [the drill](https://example.com/x)')).toBe('see the drill');
  });

  it('drops a code fence entirely', () => {
    expect(stripMarkdown('before\n```js\nconst x = 1;\n```\nafter')).toContain('before');
    expect(stripMarkdown('before\n```js\nconst x = 1;\n```\nafter')).not.toContain('const x');
  });

  it('leaves ordinary prose exactly as written', () => {
    const plain = 'Keep your weight 50/50 and swing to shoulder height.';
    expect(stripMarkdown(plain)).toBe(plain);
  });

  it('survives stray and unbalanced markers', () => {
    // A single asterisk with nothing to close it is punctuation, not emphasis.
    expect(stripMarkdown('a * b')).toBe('a * b');
    expect(stripMarkdown('**unclosed')).toBe('**unclosed');
    expect(stripMarkdown('')).toBe('');
  });
});

describe('splitBold', () => {
  it('marks only the bold run', () => {
    expect(splitBold('**Grip**: hold the club')).toEqual([
      { text: 'Grip', bold: true },
      { text: ': hold the club', bold: false },
    ]);
  });

  it('unwraps italic and code without making them bold', () => {
    // Three weights of emphasis in one chat bubble is noise.
    expect(splitBold('a *little* more')).toEqual([
      { text: 'a ', bold: false },
      { text: 'little', bold: false },
      { text: ' more', bold: false },
    ]);
  });

  it('handles several bold runs in one line', () => {
    const spans = splitBold('**one** then **two**');

    expect(spans.filter((s) => s.bold).map((s) => s.text)).toEqual(['one', 'two']);
  });

  it('returns the line whole when there is no markup', () => {
    expect(splitBold('nothing to see')).toEqual([{ text: 'nothing to see', bold: false }]);
  });

  it('does not lose the start of a line on repeated calls', () => {
    // A shared global regex would carry lastIndex between calls and silently
    // skip the beginning of the next one.
    const first = splitBold('**A** and **B**');
    const second = splitBold('**A** and **B**');

    expect(second).toEqual(first);
  });
});

describe('toLines', () => {
  it('keeps paragraph breaks as blank lines', () => {
    const lines = toLines(REPLY);

    expect(lines.some((l) => l.blank)).toBe(true);
    expect(lines.filter((l) => !l.blank)).toHaveLength(4);
  });

  it('flags a bullet and strips its marker', () => {
    const [line] = toLines('- Keep your head still');

    expect(line.bullet).toBe(true);
    expect(line.spans[0].text).toBe('Keep your head still');
  });

  it('leaves a numbered point numbered', () => {
    const [line] = toLines('1. **Grip**: neutral');

    // The number is the golfer's place in the list - dropping it would
    // renumber the coach's steps.
    expect(line.bullet).toBe(false);
    expect(line.spans[0].text).toBe('1. ');
    expect(line.spans[1]).toEqual({ text: 'Grip', bold: true });
  });

  it('gives every line a distinct key', () => {
    const lines = toLines(REPLY);
    expect(new Set(lines.map((l) => l.key)).size).toBe(lines.length);
  });
});
