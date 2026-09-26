# App icon sources

The app icon is drawn by hand as SVG. Everything in `app/src-tauri/icons/` is
generated from the files here.

| File | What it is |
|---|---|
| `icon.svg` | The master, 1024 x 1024: register-blue rounded tile (22% corner radius, transparent outside it), a pale-blue invoice sheet behind a white one with three lines, and a green tick. Used for every size from 40 px up. |
| `icon-small.svg` | Simplified variant for 16 to 32 px: no detail on the back sheet, two thicker lines, a thicker tick, no shadow. Its geometry sits on a 64-unit grid, so edges land on whole pixels at 16 and 32 px. |
| `icon-1024.png` | `icon.svg` rendered at 1024 x 1024. The input to `pnpm tauri icon`. |
| `render.mjs` | Renders an SVG to a PNG of an exact size with a transparent background using headless Microsoft Edge, and checks the corners are transparent. No dependencies. |
| `build-ico.mjs` | Rebuilds `../icon.ico` from renders at 16, 20, 24, 32 px (`icon-small.svg`) and 40, 48, 64, 256 px (`icon.svg`), 32 px first because Tauri uses the first entry as the window icon. Also overwrites `../32x32.png` with the small-variant render. |

`app/src/assets/app-icon.svg` is the same drawing as `icon-small.svg`, scaled
to a 16-unit viewBox for the in-app title bar. Update it by hand if
`icon-small.svg` changes (divide every coordinate by 64).

## Palette

| Part | Colour |
|---|---|
| Tile | `#2C52AB` to `#22479C`, top to bottom |
| Back sheet | `#DDE8F8` to `#CCDBF1` (small variant: flat `#C4D6F1`) |
| Back sheet rows | `#9DB6DF` |
| Front sheet | `#FFFFFF` to `#F0F4FB` (small variant: flat white) |
| Front sheet lines | `#1D3F8A` (register blue) |
| Tick | `#289A62` to `#36AF75` (small variant: flat `#2FA36B`) |
| Shadow under the front sheet | `#0A1E4F` at 34%, 16 down, blur 20 |

## Rebuilding

From `app/` (Git Bash; Edge must be at its default path or set `EDGE`):

```sh
node src-tauri/icons/source/render.mjs
pnpm tauri icon src-tauri/icons/source/icon-1024.png
rm -r src-tauri/icons/android src-tauri/icons/ios src-tauri/icons/64x64.png
node src-tauri/icons/source/build-ico.mjs
```

1. Renders `icon.svg` to `icon-1024.png`.
2. Regenerates the standard set (`32x32.png`, `128x128.png`,
   `128x128@2x.png`, `icon.png`, `icon.icns`, `icon.ico`, `Square*Logo.png`,
   `StoreLogo.png`) from the master.
3. Deletes the Android and iOS icons and `64x64.png` that `tauri icon` also
   writes. This is a Windows app and `tauri.conf.json` does not use them.
4. Replaces `icon.ico` and `32x32.png` so the small sizes come from
   `icon-small.svg`.

In PowerShell, step 3 is
`Remove-Item -Recurse src-tauri/icons/android, src-tauri/icons/ios, src-tauri/icons/64x64.png`.

## Provenance

The concept ("invoices and tick") comes from a Nano Banana Pro
(gemini-3-pro-image) candidate generated on 2026-09-26 from this prompt:

> A professional desktop application icon for "Student Invoice", an app that
> private music teachers use to prepare half-term invoices for their pupils'
> parents. Concept: Two overlapping invoice sheets, the front one with three
> short bold lines and a large tick mark, the back one offset up and to the
> left. Implies a batch of invoices ready to send. Palette: slate blue
> background (#3A5378), sheets in white and pale sky blue (#DCE8F5), tick in
> bright green (#3BAA6E). Style: a polished Windows 11 Fluent-style
> application icon. Clean vector look with crisp geometric shapes, subtle soft
> gradients and one gentle soft shadow under the main symbol. One bold, simple
> silhouette that stays recognisable at 16 by 16 pixels: no thin hairlines, no
> small details, no text or letters. Composition: the symbol centred with
> generous even padding (about 18 percent on every side) on a background
> colour that fills the entire square canvas edge to edge, with no rounded
> corners, no border, no frame and no outer shadow. Avoid photorealism, clay
> or plastic 3D, cartoon faces, clip-art, busy textures, watermarks.

It was then redrawn by hand as SVG, keeping the composition and retuning the
colours to the app's "Register" direction (register blue `#1D3F8A`, white
pages, feint blue rules, success green).
