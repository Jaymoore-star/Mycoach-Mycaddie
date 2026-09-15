/**
 * The small amount of markdown a coaching reply actually contains.
 *
 * The chat renders into React Native `<Text>`, which has no markdown of its
 * own, so a reply written as `**Grip**: hold the club...` arrived on screen
 * with the asterisks showing. Two consumers need this, and they need opposite
 * things from it: the bubble wants the emphasis turned into real bold, and the
 * text-to-speech wants every marker gone so the caddie does not read "asterisk
 * asterisk grip" out loud.
 *
 * Deliberately not a markdown library. A coach writes prose, bold and the
 * occasional list - pulling in a parser and a renderer for that would cost
 * more than the whole chat screen.
 */

/** `**bold**`, `__bold__`, `*italic*`, `_italic_`, and `` `code` ``. */
const EMPHASIS = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g;

/**
 * Everything a coach reply can contain, as plain sentences.
 *
 * Used before speech: markers that are invisible when rendered are very much
 * audible when synthesised.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Fenced code blocks first, so their contents are not treated as prose.
      .replace(/```[\s\S]*?```/g, ' ')
      // Headings: "## Setup" is spoken as "Setup".
      .replace(/^#{1,6}\s+/gm, '')
      // Bullets, keeping the line so the pause between points survives.
      .replace(/^\s*[-*+]\s+/gm, '')
      // Blockquote markers.
      .replace(/^\s*>\s?/gm, '')
      // Links: keep the words, drop the target.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(EMPHASIS, (_match, _a, bold, _b, italic, code) => bold ?? italic ?? code)
      // Horizontal rules read as nothing at all.
      .replace(/^\s*([-*_]\s*){3,}$/gm, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

export type TextSpan = { text: string; bold: boolean };

/**
 * Splits a line into plain and bold runs for rendering.
 *
 * Only bold is distinguished. Italic and inline code are unwrapped to their
 * contents rather than styled: a coach uses them interchangeably with bold for
 * emphasis, and three weights of emphasis in a chat bubble is noise.
 */
export function splitBold(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let index = 0;

  // A fresh regex per call: EMPHASIS is global, so a shared instance would
  // carry `lastIndex` between calls and silently skip the start of a line.
  const pattern = new RegExp(EMPHASIS.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const [whole, , bold, , italic, code] = match;

    if (match.index > index) {
      spans.push({ text: text.slice(index, match.index), bold: false });
    }

    const inner = bold ?? italic ?? code ?? whole;
    // `**` on its own is not emphasis, just stray punctuation.
    if (inner.length > 0) spans.push({ text: inner, bold: bold !== undefined });

    index = match.index + whole.length;
  }

  if (index < text.length) spans.push({ text: text.slice(index), bold: false });

  return spans.length > 0 ? spans : [{ text, bold: false }];
}

/**
 * A reply as renderable lines.
 *
 * Bullets become a real bullet character, numbered points keep their number,
 * and everything else is left as written. Blank lines are preserved because
 * the paragraph breaks are most of what makes a long answer readable.
 */
export type MarkdownLine = { key: string; spans: TextSpan[]; bullet: boolean; blank: boolean };

export function toLines(text: string): MarkdownLine[] {
  const withoutFences = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```\w*\n?/g, ''),
  );

  return withoutFences.split('\n').map((raw, i) => {
    const line = raw.replace(/^#{1,6}\s+/, '').replace(/^\s*>\s?/, '');
    const bulletMatch = /^\s*[-*+]\s+(.*)$/.exec(line);
    const content = bulletMatch ? bulletMatch[1] : line;

    return {
      key: `${i}`,
      spans: splitBold(content),
      bullet: bulletMatch !== null,
      blank: content.trim().length === 0,
    };
  });
}
