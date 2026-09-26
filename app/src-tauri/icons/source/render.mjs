// Renders an SVG to a PNG of an exact pixel size with a transparent
// background, using headless Microsoft Edge (already present on Windows, so
// no extra dependencies). Checks the result really has alpha.
//
//   node render.mjs                      icon.svg -> icon-1024.png
//   node render.mjs <in.svg> <size> <out.png>
//
// Set EDGE to the msedge.exe path if Edge is installed somewhere else.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));

export const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/** Screenshots an HTML file at width x height with a transparent background. */
export function screenshot(htmlFile, width, height, outFile) {
  if (!existsSync(EDGE)) throw new Error(`Edge not found at ${EDGE} (set EDGE)`);
  const profile = mkdtempSync(join(tmpdir(), 'si-icon-edge-'));
  try {
    execFileSync(
      EDGE,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--default-background-color=00000000',
        '--force-device-scale-factor=1',
        `--window-size=${width},${height}`,
        `--user-data-dir=${profile}`,
        `--screenshot=${resolve(outFile)}`,
        pathToFileURL(resolve(htmlFile)).href,
      ],
      { stdio: 'pipe', timeout: 60_000 },
    );
  } finally {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  if (!existsSync(outFile)) throw new Error(`Edge did not write ${outFile}`);
}

/** Renders svgFile to a size x size PNG at outFile and verifies it. */
export function render(svgFile, size, outFile) {
  const work = mkdtempSync(join(tmpdir(), 'si-icon-page-'));
  try {
    const page = join(work, 'page.html');
    writeFileSync(
      page,
      '<!doctype html><html><head><meta charset="utf-8"><style>' +
        'html,body{margin:0;padding:0;background:transparent;overflow:hidden}' +
        `img{display:block;width:${size}px;height:${size}px}` +
        `</style></head><body><img src="${pathToFileURL(resolve(svgFile)).href}"></body></html>`,
    );
    screenshot(page, size, size, outFile);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const png = decodePng(readFileSync(outFile));
  if (png.width !== size || png.height !== size) {
    throw new Error(`${outFile}: expected ${size}x${size}, got ${png.width}x${png.height}`);
  }
  const alpha = (x, y) => png.rgba[(y * png.width + x) * 4 + 3];
  // The tile's rounded corners leave the corner pixels (almost) empty; at
  // 16 px Edge's anti-aliasing can put a trace (alpha ~12) in them.
  const c = size - 1;
  const corners = [alpha(0, 0), alpha(c, 0), alpha(0, c), alpha(c, c)];
  if (corners.some((a) => a > 16)) {
    throw new Error(`${outFile}: corners are not transparent (alpha ${corners.join(', ')})`);
  }
  if (alpha(size >> 1, size >> 1) !== 255) throw new Error(`${outFile}: centre is not opaque`);
  return outFile;
}

/** Minimal PNG decoder: 8-bit RGBA or RGB, non-interlaced (what Edge writes). */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colour = data[9];
      if (depth !== 8 || (colour !== 6 && colour !== 2) || data[12] !== 0) {
        throw new Error(`unsupported PNG (depth ${depth}, colour type ${colour})`);
      }
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[y * stride + i - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= channels ? px[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = v & 0xff;
    }
  }
  if (channels === 4) return { width, height, rgba: px };
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < width * height; i++) px.copy(rgba, i * 4, i * 3, i * 3 + 3);
  return { width, height, rgba };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [svg, size, out] = process.argv.slice(2);
  if (svg) {
    console.log(render(svg, Number(size), out));
  } else {
    console.log(render(join(here, 'icon.svg'), 1024, join(here, 'icon-1024.png')));
  }
}
