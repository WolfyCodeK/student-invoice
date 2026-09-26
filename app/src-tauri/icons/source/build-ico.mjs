// Builds ../icon.ico from fresh renders (16-32 px from icon-small.svg, 40 px
// and up from icon.svg) and overwrites ../32x32.png with the small-variant
// render. Run after `pnpm tauri icon`, which writes its own icon.ico and
// 32x32.png from the master only.
//
//   node build-ico.mjs
//
// ICO layout: 6-byte header, one 16-byte directory entry per frame, then
// each frame's PNG bytes (PNG-compressed entries, Windows Vista and later).

import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const icons = join(here, '..');

// Order matters: Tauri uses the first entry as the default window icon, so
// 32 px leads, as it does in the icon.ico that `tauri icon` writes.
const frames = [
  [32, 'icon-small.svg'],
  [16, 'icon-small.svg'],
  [20, 'icon-small.svg'],
  [24, 'icon-small.svg'],
  [40, 'icon.svg'],
  [48, 'icon.svg'],
  [64, 'icon.svg'],
  [256, 'icon.svg'],
];

const work = mkdtempSync(join(tmpdir(), 'si-icon-frames-'));
try {
  const images = frames.map(([size, svg]) => {
    const png = join(work, `${size}.png`);
    render(join(here, svg), size, png);
    return { size, png, data: readFileSync(png) };
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette colours
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  const ico = Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
  writeFileSync(join(icons, 'icon.ico'), ico);
  copyFileSync(images.find((i) => i.size === 32).png, join(icons, '32x32.png'));

  console.log(`icon.ico: ${images.map((i) => i.size).join(', ')} px (${ico.length} bytes)`);
  console.log('32x32.png: small variant');
} finally {
  rmSync(work, { recursive: true, force: true });
}
