#!/usr/bin/env node
// Generates toolbar icons with a red "live" dot (icons/icon*-active.png).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'icons');
const SIZES = [16, 32, 48, 128];
const DOT_COLOR = '#E91916';

const dotSvg = (size) => {
  const radius = Math.max(2, Math.round(size * 0.17));
  const margin = Math.max(1, Math.round(size * 0.06));
  const cx = size - radius - margin;
  const cy = radius + margin;
  const stroke = Math.max(1, Math.round(size / 14));
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${DOT_COLOR}" stroke="#FFFFFF" stroke-width="${stroke}"/>
    </svg>`,
  );
};

for (const size of SIZES) {
  const basePath = join(ICONS, `icon${size}.png`);
  const outPath = join(ICONS, `icon${size}-active.png`);
  const base = readFileSync(basePath);
  const overlay = await sharp(dotSvg(size)).resize(size, size).png().toBuffer();
  await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).png().toFile(outPath);
  console.log(`wrote ${outPath}`);
}
