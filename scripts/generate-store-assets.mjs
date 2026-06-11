#!/usr/bin/env node
// Renders Chrome Web Store promo images with embedded Space Grotesk + DM Sans.
import sharp from 'sharp';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/store');

const C = {
  bg0: '#0e0b14',
  bg1: '#1c1729',
  surface: '#231e32',
  border: '#3a3450',
  borderSoft: '#2e2840',
  text: '#f7f5fb',
  textDim: '#c9c0dc',
  textFaint: '#958aa8',
  violet: '#c4a3ff',
  violetStrong: '#7c3aed',
  live: '#ff7054',
};

const fonts = (() => {
  const sg = readFileSync(join(ROOT, 'src/fonts/spacegrotesk-latin.woff2')).toString('base64');
  const dm = readFileSync(join(ROOT, 'src/fonts/dmsans-latin.woff2')).toString('base64');
  return `
    @font-face {
      font-family: 'SG';
      src: url(data:font/woff2;base64,${sg}) format('woff2');
      font-weight: 400 700;
    }
    @font-face {
      font-family: 'DM';
      src: url(data:font/woff2;base64,${dm}) format('woff2');
      font-weight: 400 600;
    }
  `;
})();

const iconSvg = (size, x, y) => {
  const s = size / 96;
  return `
    <g transform="translate(${x}, ${y}) scale(${s})">
      <rect width="96" height="96" rx="22" fill="${C.violetStrong}"/>
      <path d="M64 34 A21 21 0 1 0 69 50" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M0 -9 L8.5 7.5 L-8.5 7.5 Z" fill="#ffffff" transform="translate(63 33) rotate(48)"/>
      <path d="M43 39 L43 57 L59 48 Z" fill="#ffffff"/>
    </g>
  `;
};

const wordmark = (x, y, size, anchor = 'start') => `
  <text x="${x}" y="${y}" font-family="SG" font-weight="700" font-size="${size}" fill="${C.text}"
    letter-spacing="-0.02em" text-anchor="${anchor}">
    support<tspan fill="${C.violet}">my</tspan>streamers
  </text>
`;

const bgGradient = (id = 'bg') => `
  <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${C.bg1}"/>
    <stop offset="55%" stop-color="${C.bg0}"/>
    <stop offset="100%" stop-color="#070509"/>
  </linearGradient>
  <radialGradient id="glow" cx="30%" cy="40%" r="70%">
    <stop offset="0%" stop-color="${C.violetStrong}" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="${C.violetStrong}" stop-opacity="0"/>
  </radialGradient>
`;

const svgWrap = (width, height, body) => `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fonts}</style>
    ${bgGradient()}
    <filter id="cardShadow" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="18" stdDeviation="28" flood-color="#000" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${C.violetStrong}" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  ${body}
</svg>`;

const buildPromoSmall = () => svgWrap(
  440,
  280,
  `
    ${iconSvg(72, 184, 36)}
    ${wordmark(220, 132, 28, 'middle')}
    <text x="220" y="168" font-family="DM" font-size="15" fill="${C.textFaint}" text-anchor="middle">
      apoie seus streamers da Twitch
    </text>
  `,
);

const buildPromoMarquee = () => svgWrap(
  1400,
  560,
  `
    ${iconSvg(88, 72, 96)}
    ${wordmark(184, 168, 36)}
    <text x="72" y="268" font-family="SG" font-weight="700" font-size="62" fill="${C.text}" letter-spacing="-0.03em">
      Apoie quem você <tspan fill="${C.violet}">assiste.</tspan>
    </text>
    <text x="72" y="328" font-family="DM" font-size="24" fill="${C.textDim}">
      Veja quem você segue ao vivo e deixe a rotação rolar.
    </text>
  `,
);

const renderScreenshot = async () => {
  const fixture = join(ROOT, 'scripts/fixtures/store-screenshot.html');
  const out = join(OUT, 'screenshot-1.png');
  const sg = readFileSync(join(ROOT, 'src/fonts/spacegrotesk-latin.woff2')).toString('base64');
  const dm = readFileSync(join(ROOT, 'src/fonts/dmsans-latin.woff2')).toString('base64');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(pathToFileURL(fixture).href, { waitUntil: 'load' });
    await page.addStyleTag({
      content: `
        @font-face {
          font-family: "Space Grotesk";
          src: url(data:font/woff2;base64,${sg}) format("woff2");
          font-weight: 400 700;
          font-display: swap;
        }
        @font-face {
          font-family: "DM Sans";
          src: url(data:font/woff2;base64,${dm}) format("woff2");
          font-weight: 400 600;
          font-display: swap;
        }
      `,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, type: 'png' });
    console.log(`wrote ${out}`);
  } finally {
    await browser.close();
  }
};

const render = async (name, svg) => {
  const path = join(OUT, name);
  await sharp(Buffer.from(svg)).png().toFile(path);
  console.log(`wrote ${path}`);
};

await render('promo-small-440x280.png', buildPromoSmall());
await render('promo-marquee-1400x560.png', buildPromoMarquee());
await renderScreenshot();
