/**
 * Generates the app's launcher, splash and adaptive icons from the official
 * Dominus Golf mark (the same crescent + pin paths the web app draws).
 *
 * Run from `mobile/` after installing sharp:  node scripts/make-icons.js
 * sharp is not a dependency of the app - this runs by hand when the mark
 * changes, not as part of a build.
 *
 * Source of truth for the geometry:
 *   reference/src/components/ui/dominus-logo.tsx
 *
 * The artwork is NOT centred inside its own 100x120 viewBox - the crescent
 * reaches x=88 while the pin starts at x=43 - so the mark is rendered large on
 * transparency, trimmed to its real content bounds, and then composited into
 * the middle of the canvas. Centring the viewBox instead leaves the mark
 * visibly pushed to the right.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.resolve(__dirname, '..', 'assets', 'images');

const GOLD = '#C5A059';
const CHARCOAL = '#141311';

const CRESCENT_D = `
  M 45 12
  C 62 10, 88 28, 88 55
  C 88 78, 76 94, 60 96
  C 65 90, 68 82, 62 76
  C 74 70, 76 58, 76 55
  C 76 32, 62 16, 45 16
  Z
`;

const PIN_D = `
  M 45 12
  C 46.8 30, 47.2 46, 46.5 65
  L 45 100
  C 43.5 65, 43.2 46, 43.2 30
  Z
`;

/** The bare mark, rendered tall on a transparent canvas. */
function markSvg(height, fill) {
  const w = Math.round((height * 100) / 120);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 100 120">
  <path d="${CRESCENT_D.trim()}" fill="${fill}"/>
  <path d="${PIN_D.trim()}" fill="${fill}"/>
</svg>`;
}

/**
 * Renders the mark trimmed to its content, scaled so its tallest dimension
 * occupies `coverage` of the canvas, and centred on `background`.
 *
 * `coverage` is what the launcher actually shows: 0.62 is a normal app icon,
 * while an Android adaptive foreground needs ~0.42 because the launcher masks
 * away the outer third of the square.
 */
async function render({ size, coverage, fill, background }) {
  // Render at 3x the target so the trim and the downscale stay sharp.
  const mark = await sharp(Buffer.from(markSvg(size * 3, fill)))
    .png()
    .trim()
    .toBuffer();

  const target = Math.round(size * coverage);
  const scaled = await sharp(mark)
    .resize({ height: target, fit: 'inside' })
    .toBuffer();
  const { width: sw, height: sh } = await sharp(scaled).metadata();

  const canvas = background
    ? { create: { width: size, height: size, channels: 4, background } }
    : {
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      };

  return sharp(canvas)
    .composite([
      {
        input: scaled,
        left: Math.round((size - sw) / 2),
        top: Math.round((size - sh) / 2),
      },
    ])
    .png()
    .toBuffer();
}

const jobs = [
  // Launcher icon: gold mark on brand charcoal. iOS and Android both round the
  // corners themselves, so this ships as a full-bleed square.
  { file: 'icon.png', size: 1024, coverage: 0.62, fill: GOLD, background: CHARCOAL },
  // Splash: transparent - expo-splash-screen paints the charcoal behind it.
  { file: 'splash-icon.png', size: 512, coverage: 0.86, fill: GOLD, background: null },
  // Adaptive foreground: Android reserves the outer ~33% for the mask.
  { file: 'android-icon-foreground.png', size: 1024, coverage: 0.42, fill: GOLD, background: null },
  // Monochrome (themed icons, Android 13+): the system tints the silhouette.
  { file: 'android-icon-monochrome.png', size: 1024, coverage: 0.42, fill: '#FFFFFF', background: null },
  { file: 'favicon.png', size: 196, coverage: 0.66, fill: GOLD, background: CHARCOAL },
];

(async () => {
  for (const { file, ...opts } of jobs) {
    const dest = path.join(OUT, file);
    fs.writeFileSync(dest, await render(opts));
    console.log(`wrote ${file.padEnd(32)} ${fs.statSync(dest).size} bytes`);
  }

  // The adaptive background is a flat brand fill; no artwork on it.
  const bg = path.join(OUT, 'android-icon-background.png');
  fs.writeFileSync(
    bg,
    await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: CHARCOAL },
    })
      .png()
      .toBuffer()
  );
  console.log(`wrote ${'android-icon-background.png'.padEnd(32)} ${fs.statSync(bg).size} bytes`);
})();
