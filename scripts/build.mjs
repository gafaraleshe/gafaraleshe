/*
 * Builds the README header images in assets/{dark,light}/ — the top of
 * gafaraleshe.com (name row, intro, buttons) drawn with the site's fonts and
 * palette so the profile reads like the portfolio.
 *
 * GitHub serves repo images with `default-src 'none'`, so an SVG can't load
 * fonts or embedded images. Text is therefore set here with opentype.js and
 * written out as outlines, and the photo ships as its own PNG.
 *
 *   npm install && npm run build
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "assets");

const font = (pkg, file) =>
  opentype.loadSync(
    path.join(ROOT, "node_modules/@fontsource", pkg, "files", file),
  );
const GEIST = font("geist", "geist-latin-400-normal.woff");
const GEIST_MEDIUM = font("geist", "geist-latin-500-normal.woff");
const CAVEAT = font("caveat", "caveat-latin-500-normal.woff");

// The site's ink scale (app/globals.css): dark is the default theme, light
// is the neutral-900…400 ramp of the cream theme.
const THEMES = {
  dark: {
    ink: "#ededed",
    dim: "#a1a1a1",
    muted: "#8a8a8a",
    faint: "#5e5e5e",
    paper: "#0a0a0a",
    tile: "#161616",
    border: "rgba(237,237,237,0.15)",
    ring: "rgba(237,237,237,0.1)",
  },
  light: {
    ink: "#171717",
    dim: "#525252",
    muted: "#737373",
    faint: "#a3a3a3",
    paper: "#f4f3ec",
    tile: "#ffffff",
    border: "rgba(23,23,23,0.15)",
    ring: "rgba(23,23,23,0.1)",
  },
};

// Column width of the site's card (760px less 48px padding a side).
const COLUMN = 664;
// The header row: photo, a 14px gap and the name block on the left, five
// 32px icon tiles (4px apart) flush with the right edge of the column. The
// gap rides on the photo so the name lines up flush left when it wraps.
const HEADER_H = 51;
const AVATAR = 44;
const GAP = 14;
const ICON_W = 36;
const INTRO_W = COLUMN - AVATAR - GAP - 5 * ICON_W;

// Intro paragraphs. Each one is its own image linking to `href`; plain runs
// are dim, "ink" runs are brighter and "link" runs are underlined as well.
const BIO = [
  {
    name: "bio-1",
    href: "https://gafaraleshe.com",
    runs: [
      ["Hey, I'm Gafar — a software engineer based in "],
      ["Portsmouth, UK", "ink"],
      [
        ". I work across full-stack and frontend, building accessible, type-safe web apps with TypeScript, React, Next.js and Node.js.",
      ],
    ],
  },
  {
    name: "bio-2",
    href: "https://hermitelabs.com",
    runs: [
      ["I've shipped 25+ responsive sites and apps at "],
      ["FrontToBack", "link"],
      [", and I'm building "],
      ["Hermite Labs", "link"],
      [" — software for creative businesses, starting with the "],
      ["HermiteFlow", "link"],
      [" CRM and invoicing app."],
    ],
  },
  {
    name: "bio-3",
    href: "https://gafaraleshe.com/cinema",
    runs: [
      ["Away from the editor I shoot photo and film as "],
      ["SHOTBYGAFAR", "ink"],
      [" — that side lives in the "],
      ["cinema", "link"],
      [", with my LUTs and presets in the "],
      ["shop", "link"],
      ["."],
    ],
  },
];

// Simple Icons (CC0) and the outlined envelope, as on the site.
const PROFILES = {
  instagram:
    "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  x: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  mail: null,
};

// lucide-react icons used in the buttons.
const LUCIDE = {
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
};

// The site's entrance ease, cubic-bezier(0.22, 1, 0.36, 1).
const EASE = "cubic-bezier(0.22,1,0.36,1)";
const STILL =
  "@media (prefers-reduced-motion:reduce){*{animation:none!important}}";

// ── Type ──

const round = (n) => Math.round(n * 100) / 100;

// Glyphs of `text` with GPOS kerning and CSS-style letter-spacing, one per
// character (no ligatures) so styles can be applied by string index.
function shape(face, text, size, tracking = 0) {
  const scale = size / face.unitsPerEm;
  const glyphs = Array.from(text, (ch) => face.charToGlyph(ch));
  const lookups = face.position.defaultKerningTables;
  const placed = [];
  let x = 0;
  glyphs.forEach((glyph, i) => {
    placed.push({ glyph, x });
    x += glyph.advanceWidth * scale + tracking;
    const next = glyphs[i + 1];
    if (next && lookups)
      x +=
        face.position.getKerningValue(lookups, glyph.index, next.index) * scale;
  });
  return { placed, width: x };
}

// Baseline of a CSS line box of height `lineHeight` starting at `top`.
function baseline(face, size, lineHeight, top) {
  const em = size / face.unitsPerEm;
  const content = (face.ascender - face.descender) * em;
  return top + (lineHeight - content) / 2 + face.ascender * em;
}

function outline(face, placed, size, x, y) {
  return placed
    .map((p) => p.glyph.getPath(x + p.x, y, size).toPathData(2))
    .join("");
}

// Greedy wrap at spaces, as the browser does for this copy.
function wrap(face, text, size, width) {
  const words = text.split(" ");
  const lines = [];
  let start = 0;
  let line = words[0];
  let offset = words[0].length + 1;
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (shape(face, candidate, size).width <= width) {
      line = candidate;
    } else {
      lines.push({ start, text: line });
      start = offset;
      line = word;
    }
    offset += word.length + 1;
  }
  lines.push({ start, text: line });
  return lines;
}

// Underline under `placed` glyphs at `y`, broken around descenders the way
// `text-decoration-skip-ink` does.
function underline(face, placed, size, x, base, y, color) {
  const from = x + placed[0].x;
  const last = placed[placed.length - 1];
  const to = x + last.x + last.glyph.advanceWidth * (size / face.unitsPerEm);
  const gaps = [];
  for (const p of placed) {
    const ink = p.glyph.getPath(x + p.x, base, size).commands;
    const low = ink.flatMap((c) =>
      [
        [c.x, c.y],
        [c.x1, c.y1],
        [c.x2, c.y2],
      ].filter(([px, py]) => px !== undefined && py > y - 1),
    );
    if (low.length) {
      const xs = low.map(([px]) => px);
      gaps.push([Math.min(...xs) - 1.5, Math.max(...xs) + 1.5]);
    }
  }
  const rects = [];
  let cursor = from;
  for (const [a, b] of gaps.sort((m, n) => m[0] - n[0])) {
    if (a > cursor) rects.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < to) rects.push([cursor, to]);
  return rects
    .map(
      ([a, b]) =>
        `<rect x="${round(a)}" y="${y}" width="${round(b - a)}" height="1" fill="${color}"/>`,
    )
    .join("");
}

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg(width, height, body, { title, style } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}" fill="none">` +
    (title ? `<title>${escape(title)}</title>` : "") +
    (style ? `<style>${style}</style>` : "") +
    body +
    "</svg>\n"
  );
}

// ── Pieces ──

// Name and title, with the site's letter-by-letter reveal on the name.
function intro(t) {
  const x = 0;
  const nameSize = 18;
  const name = shape(GEIST_MEDIUM, "Gafar Aleshe", nameSize, -0.015 * nameSize);
  const nameBase = Math.round(baseline(GEIST_MEDIUM, nameSize, 27, 0));
  const letters = name.placed
    .filter((p) => p.glyph.unicode !== 32)
    .map(
      (p, i) =>
        `<path class="l" style="animation-delay:${round(0.2 + i * 0.03)}s" d="${outline(GEIST_MEDIUM, [p], nameSize, x, nameBase)}"/>`,
    )
    .join("");

  const subSize = 14.5;
  const sub = "Software engineer / @gafaraleshe";
  const split = "Software engineer ".length;
  const { placed } = shape(GEIST, sub, subSize);
  const subBase = Math.round(baseline(GEIST, subSize, 21.75, 29));
  const muted = outline(GEIST, placed.slice(0, split), subSize, x, subBase);
  const faint = outline(GEIST, placed.slice(split), subSize, x, subBase);

  return svg(
    INTRO_W,
    HEADER_H,
    `<g fill="${t.ink}">${letters}</g>` +
      `<path fill="${t.muted}" d="${muted}"/><path fill="${t.faint}" d="${faint}"/>`,
    {
      title: "Gafar Aleshe — Software engineer / @gafaraleshe",
      style:
        `@keyframes r{from{opacity:0;transform:translateX(14px);filter:blur(4px)}}` +
        `.l{animation:r .32s ${EASE} backwards}${STILL}`,
    },
  );
}

// One profile tile: a 16px glyph in a 32px square, 4px after the last one.
function profileIcon(t, key) {
  const glyph =
    key === "mail"
      ? `<g stroke="${t.muted}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${LUCIDE.mail}</g>`
      : `<path fill="${t.muted}" d="${PROFILES[key]}"/>`;
  return svg(
    ICON_W,
    HEADER_H,
    `<g transform="translate(12 12) scale(${round(16 / 24)})">${glyph}</g>`,
  );
}

function paragraph(t, { runs }) {
  const size = 15.5;
  const lineHeight = size * 1.75;
  // The line box's half-leading above the first line and below the last is
  // trimmed (keeping the underline) so GitHub's paragraph margins land near
  // the site's 14px gap.
  const trimTop = 5;
  const trimBottom = 3;
  let text = "";
  const styles = [];
  for (const [chunk, style = "dim"] of runs) {
    text += chunk;
    styles.push(...Array.from(chunk, () => style));
  }

  const lines = wrap(GEIST, text, size, COLUMN);
  let body = "";
  lines.forEach((line, i) => {
    const base = Math.round(
      baseline(GEIST, size, lineHeight, i * lineHeight - trimTop),
    );
    const { placed } = shape(GEIST, line.text, size);
    // Consecutive glyphs of one style become one path.
    let group = [];
    const flush = () => {
      if (!group.length) return;
      const style = styles[line.start + group[0].i];
      const glyphs = group.map((g) => g.p);
      body += `<path fill="${style === "dim" ? t.dim : t.ink}" d="${outline(GEIST, glyphs, size, 0, base)}"/>`;
      if (style === "link")
        body += underline(GEIST, glyphs, size, 0, base, base + 3, t.faint);
      group = [];
    };
    placed.forEach((p, i) => {
      if (
        group.length &&
        styles[line.start + i] !== styles[line.start + group[0].i]
      )
        flush();
      group.push({ p, i });
    });
    flush();
  });

  return svg(COLUMN, lines.length * lineHeight - trimTop - trimBottom, body, {
    title: text,
  });
}

// "Email me" (solid) or "Résumé" (outlined), 37/39px tall on a 39px row.
function button(t, { label, icon, solid, gap }) {
  const size = 14;
  const border = solid ? 0 : 1;
  const text = shape(GEIST_MEDIUM, label, size);
  const width = border + 14 + 15 + 6 + text.width + 14 + border;
  const height = 37 + 2 * border;
  const top = (39 - height) / 2;
  const fg = solid ? t.paper : t.ink;
  const box = solid
    ? `<rect x="${gap}" y="${top}" width="${round(width)}" height="${height}" rx="8" fill="${t.ink}"/>`
    : `<rect x="${gap + 0.5}" y="${top + 0.5}" width="${round(width - 1)}" height="${height - 1}" rx="7.5" fill="${t.tile}" stroke="${t.border}"/>`;
  const x = gap + border + 14;
  const base = Math.round(baseline(GEIST_MEDIUM, size, 21, 9));
  return svg(
    gap + width,
    39,
    box +
      `<g transform="translate(${x} 12) scale(${15 / 24})" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${LUCIDE[icon]}</g>` +
      `<path fill="${fg}" d="${outline(GEIST_MEDIUM, text.placed, size, x + 21, base)}"/>`,
    { title: label },
  );
}

// The hand-written "open to work" note and the arrow drawn back at the
// buttons. The canvas runs 8px above the button row for the tilted text.
function openToWork(t) {
  const lift = 8;
  const left = 20;
  const size = 21;
  const text = shape(CAVEAT, "open to work", size);
  const tx = left + 56 + 4;
  const top = -1 + lift;
  const base = round(baseline(CAVEAT, size, size, top));
  const cx = round(tx + text.width / 2);
  const cy = round(top + size / 2);
  return svg(
    tx + text.width + 4,
    39 + lift,
    `<g transform="translate(${left} ${5.5 + lift}) scale(0.875)" stroke="${t.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path class="d" pathLength="1" d="M60 22C46 30 22 28 6 12"/>` +
      `<path class="d" pathLength="1" style="animation-delay:1.6s" d="M5 22L5 11L16 10"/></g>` +
      `<path class="n" fill="${t.muted}" d="${outline(CAVEAT, text.placed, size, tx, base)}"/>`,
    {
      title: "open to work",
      style:
        `@keyframes d{from{stroke-dashoffset:1}}` +
        `@keyframes n{from{opacity:0;transform:translateY(4px) rotate(-8deg)}}` +
        `.d{stroke-dasharray:1;animation:d .9s cubic-bezier(0.45,0,0.3,1) .9s backwards}` +
        `.n{transform-origin:${cx}px ${cy}px;transform:rotate(-6deg);animation:n .6s ${EASE} 1.1s backwards}` +
        STILL,
    },
  );
}

// The grayscale photo in its hairline ring, sitting where the site's
// 44px avatar does in the 51px header row, plus the gap before the name.
async function avatar(t) {
  const scale = 3;
  const px = (n) => Math.round(n * scale);
  const top = (HEADER_H - AVATAR) / 2;
  const inner = px(AVATAR - 2);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}"/></svg>`,
  );
  const photo = await sharp(path.join(OUT, "src/profile.jpg"))
    .resize(inner, inner)
    .grayscale()
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const ring = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px(AVATAR)}" height="${px(HEADER_H)}"><circle cx="${px(AVATAR) / 2}" cy="${px(top + AVATAR / 2)}" r="${(px(AVATAR) - scale) / 2}" fill="none" stroke="${t.ring}" stroke-width="${scale}"/></svg>`,
  );
  return sharp({
    create: {
      width: px(AVATAR + GAP),
      height: px(HEADER_H),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: photo, left: scale, top: px(top) + scale },
      { input: ring, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ── Build ──

for (const [theme, t] of Object.entries(THEMES)) {
  const dir = path.join(OUT, theme);
  await mkdir(dir, { recursive: true });
  const files = {
    "avatar.png": await avatar(t),
    "intro.svg": intro(t),
    ...Object.fromEntries(
      Object.keys(PROFILES).map((key) => [`${key}.svg`, profileIcon(t, key)]),
    ),
    ...Object.fromEntries(BIO.map((p) => [`${p.name}.svg`, paragraph(t, p)])),
    "email.svg": button(t, {
      label: "Email me",
      icon: "mail",
      solid: true,
      gap: 0,
    }),
    "resume.svg": button(t, {
      label: "Résumé",
      icon: "download",
      solid: false,
      gap: 8,
    }),
    "open-to-work.svg": openToWork(t),
  };
  for (const [name, data] of Object.entries(files))
    await writeFile(path.join(dir, name), data);
  console.log(`${theme}: ${Object.keys(files).join(", ")}`);
}
