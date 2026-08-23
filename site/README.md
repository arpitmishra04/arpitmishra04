# arpitm.in — portfolio site

Static site. No framework, no build step, no package manifest — open
[`index.html`](./index.html) in a browser and it runs.

```
site/
├─ index.html              single page, seven sections
└─ assets/
   ├─ css/main.css         tokens → base → chrome → hero → sections → overlays
   ├─ js/trace.js          hero canvas: lattice + travelling request pulses
   ├─ js/console.js        the working shell in section 06
   ├─ js/main.js           theme, command palette, scroll spy, reveals, counters
   └─ img/                 favicon.svg, og.svg (source) and og.png (rendered)
```

## Design notes

Palette, grid and the amber accent are lifted from the hand-authored SVGs in
[`../assets`](../assets) so the site and the GitHub profile read as one thing.

- **Themes** — `ink` (default) and `paper`, stored under `am-theme` in
  `localStorage`. First visit follows `prefers-color-scheme`. An inline script in
  `<head>` applies it before first paint so there is no flash.
- **Type** — IBM Plex Sans / Mono, with Instrument Serif for section subtitles
  and pull quotes. System stacks are declared as fallbacks.
- **Motion** — everything checks `prefers-reduced-motion`. When it's set, the
  hero canvas renders one static frame and reveals resolve immediately.

## Keyboard

| Key | Does |
|:--|:--|
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> or <kbd>/</kbd> | command palette |
| <kbd>T</kbd> | flip theme |
| <kbd>C</kbd> | jump into the console |
| <kbd>↑</kbd> <kbd>↓</kbd> | history in the console, results in the palette |
| <kbd>Tab</kbd> | command completion in the console |

## Editing content

All copy lives in `index.html` — there is no CMS and no data file to keep in
sync. The console commands (`whoami`, `career`, `stack`, `work`, `contact`) hold
their own short-form copy in `assets/js/console.js`; if a fact changes on the
page, change it there too.

## Social image

`assets/img/og.svg` is the source; `og.png` is the 1200×630 render referenced by
the `og:image` / `twitter:image` tags. After editing the SVG, re-render it with
any SVG rasteriser, for example:

```powershell
npx --yes @resvg/resvg-js-cli assets/img/og.svg assets/img/og.png --width 1200
```

## Deployment

[`../.github/workflows/pages.yml`](../.github/workflows/pages.yml) publishes this
folder to GitHub Pages on every push to `main` that touches `site/`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub
Actions**. To serve it from `arpitm.in`, add the domain under **Custom domain**
and commit a `CNAME` file containing the bare domain into this folder.

Local preview — the repo ships a tiny static server with no dependencies:

```powershell
node tools/serve.js          # http://127.0.0.1:8099
node tools/serve.js 3000     # or pick a port
```

It sends `cache-control: no-store`, so a plain refresh always shows your latest
edit. Any other static server works too — `npx --yes serve site`.
