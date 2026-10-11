/*
 * Builds the README: the top of gafaraleshe.com, from the nav down to Skills,
 * as a black panel cut into full-width strips, each its own image and link.
 * README.md floats the strips left so they stack with no gap between them.
 *
 * The page is written here as HTML with the site's CSS values, laid out by
 * Chromium, printed to PDF strip by strip and turned into SVG by pdftocairo,
 * so the text keeps its exact shape as vector outlines. GitHub serves repo
 * images with `default-src 'none'`, so nothing may be embedded: the photo is
 * drawn as a mosaic of grey rectangles instead.
 *
 * Two layouts, as on the site: desktop (824px) and mobile (390px). README.md
 * picks one by viewport width.
 *
 * The Activity graph comes from GitHub's public calendar. When it can't be
 * read (no network), the last copy in assets/activity.json is used. A daily
 * workflow (.github/workflows/readme.yml) rebuilds and commits.
 *
 *   npm install && npm run build   (needs pdftocairo from poppler-utils)
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";
import sharp from "sharp";
import { optimize } from "svgo";
import { BRANDS, PROFILES } from "./icons.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ASSETS = path.join(ROOT, "assets");
const NODE_MODULES = path.join(ROOT, "node_modules");
const run = promisify(execFile);

const USERNAME = "gafaraleshe";
const SITE = "https://gafaraleshe.com";
const EMAIL = "contact@gafaraleshe.com";

// ── Content (app/page.tsx) ──

const profiles = [
  ["Instagram", "instagram"],
  ["X", "x"],
  ["GitHub", "github"],
  ["LinkedIn", "linkedin"],
  ["Email", "mail"],
];

const experience = [
  {
    company: "FrontToBack",
    role: "Frontend Developer & Creative Director",
    start: "Dec 22",
    end: "Now",
  },
  {
    company: "SHOTBYGAFAR",
    role: "Founder & Creative Director",
    start: "Aug 24",
    end: "Now",
  },
];

const skills = [
  ["Language", ["TypeScript", "JavaScript", "Python"]],
  [
    "Frontend",
    [
      "React",
      "Next.js",
      "Vue",
      "Redux",
      "Tailwind CSS",
      "Vite",
      "HTML5",
      "CSS3",
      "TanStack Query",
      "React Hook Form",
    ],
  ],
  ["Backend", ["Node.js", "REST APIs", "JWT", "OAuth 2.0", "WebAuthn"]],
  ["Data", ["PostgreSQL", "MongoDB", "SQL", "Drizzle ORM", "Zod"]],
  [
    "DevOps & Testing",
    [
      "AWS",
      "Docker",
      "Git",
      "GitHub Actions",
      "CI/CD",
      "Jest",
      "Cypress",
      "TDD",
    ],
  ],
  [
    "Accessibility",
    [
      "Semantic HTML",
      "WCAG",
      "ARIA",
      "Keyboard Accessibility",
      "Screen Readers",
    ],
  ],
];

// Skills without a brand logo get a lucide glyph, as on the site.
const CONCEPTS = {
  restapis: "braces",
  oauth20: "key-round",
  sql: "database",
  cicd: "workflow",
  tdd: "flask-conical",
  semantichtml: "code-xml",
  wcag: "shield-check",
  aria: "accessibility",
  keyboardaccessibility: "keyboard",
  screenreaders: "speech",
};
const ALIASES = { css: "css3", html: "html5" };

// The strips, top to bottom: the block each one is cut around, where it
// links and its alt text. Cuts fall halfway between neighbouring blocks.
const STRIPS = [
  {
    name: "header",
    href: SITE,
    alt: "Gafar Aleshe — Software engineer / @gafaraleshe",
  },
  {
    name: "intro-1",
    href: SITE,
    alt: "Hey, I'm Gafar — a software engineer based in Portsmouth, UK. I work across full-stack and frontend, building accessible, type-safe web apps with TypeScript, React, Next.js and Node.js.",
  },
  {
    name: "intro-2",
    href: "https://hermitelabs.com",
    alt: "I've shipped 25+ responsive sites and apps at FrontToBack, and I'm building Hermite Labs — software for creative businesses, starting with the HermiteFlow CRM and invoicing app.",
  },
  {
    name: "intro-3",
    href: `${SITE}/cinema`,
    alt: "Away from the editor I shoot photo and film as SHOTBYGAFAR — that side lives in the cinema, with my LUTs and presets in the shop.",
  },
  {
    name: "buttons",
    href: `mailto:${EMAIL}`,
    alt: "Email me · Résumé — open to work",
  },
  { name: "activity", href: `https://github.com/${USERNAME}` },
  {
    name: "experience",
    href: `${SITE}/#experience`,
    alt: "Experience: FrontToBack, Frontend Developer & Creative Director, Dec 22 – Now. SHOTBYGAFAR, Founder & Creative Director, Aug 24 – Now.",
  },
  {
    name: "skills",
    href: `${SITE}/#skills`,
    alt: `Skills: ${skills.map(([c, items]) => `${c} — ${items.join(", ")}`).join(". ")}.`,
  },
  {
    name: "footer",
    href: `${SITE}/links`,
    alt: "Portsmouth, United Kingdom · All links",
  },
];

const LAYOUTS = {
  desktop: { width: 824, mobile: false },
  mobile: { width: 392, mobile: true },
};

// The width at and below which README.md shows the mobile strips.
const MOBILE_MAX = 1199;

// ── Activity (lib/github.ts) ──

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

async function fetchActivity() {
  const cache = path.join(ASSETS, "activity.json");
  try {
    const res = await fetch(
      `https://github.com/users/${USERNAME}/contributions`,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const activity = parseCalendar(await res.text());
    if (!activity) throw new Error("no days in the calendar");
    await writeFile(cache, JSON.stringify(activity) + "\n");
    return activity;
  } catch (error) {
    console.warn(
      `Activity: ${error.message}; using ${path.relative(ROOT, cache)}`,
    );
    return JSON.parse(await readFile(cache, "utf8").catch(() => "null"));
  }
}

function parseCalendar(html) {
  const attr = (tag, name) =>
    new RegExp(`\\s${name}=["']([^"']*)["']`, "i").exec(tag)?.[1];
  const tips = new Map();
  for (const [, attrs, text] of html.matchAll(
    /<tool-tip\b([^>]*)>([^<]*)<\/tool-tip>/gi,
  ))
    tips.set(attr(attrs, "for"), text);

  const days = new Map();
  for (const [tag] of html.matchAll(/<[a-z][\w-]*\s[^>]*data-date=[^>]*>/gi)) {
    const date = attr(tag, "data-date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;
    const tip = /^\s*(no|[\d,]+)\s+contributions?\b/i.exec(
      tips.get(attr(tag, "id")) ?? "",
    );
    const count =
      !tip || /no/i.test(tip[1]) ? 0 : Number(tip[1].replace(/,/g, ""));
    const level = Number(attr(tag, "data-level"));
    days.set(date, {
      date,
      count,
      level: level >= 0 && level <= 4 ? level : count > 0 ? 1 : 0,
    });
  }
  const sorted = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!sorted.length) return null;

  const utc = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8));
  const end = utc(sorted.at(-1).date);
  const year = sorted.filter((d) => end - utc(d.date) < 54 * 7 * DAY_MS);
  const start = utc(year[0].date);
  const lead = new Date(start).getUTCDay();
  const weeks = [];
  for (const day of year) {
    const i = lead + Math.round((utc(day.date) - start) / DAY_MS);
    while (weeks.length <= Math.floor(i / 7)) weeks.push(Array(7).fill(null));
    weeks[Math.floor(i / 7)][i % 7] = day.level;
    weeks[Math.floor(i / 7)].month ??= +day.date.slice(5, 7) - 1;
  }
  const total = /([\d,]+)\s+contributions?\s+in\s+the\s+last\s+year/i.exec(
    html,
  );
  return {
    total: total
      ? Number(total[1].replace(/,/g, ""))
      : year.reduce((n, d) => n + d.count, 0),
    // Per week: seven levels (null outside the year) and the month of its
    // first day, for the labels.
    weeks: weeks.map((w) => ({ month: w.month, levels: [...w] })),
  };
}

// A column is labelled when its first day starts a new month; a month with
// fewer than two columns has no room for its name.
function monthLabels(weeks) {
  const starts = [];
  weeks.forEach(({ month }, col) => {
    if (starts.at(-1)?.month !== month) starts.push({ col, month });
  });
  return starts
    .map(({ col, month }, i) => ({
      col,
      span: (starts[i + 1]?.col ?? weeks.length) - col,
      name: MONTHS[month],
    }))
    .filter((label) => label.span >= 2);
}

// ── Pieces ──

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const lucideCache = new Map();
async function lucide(name, attrs = "") {
  if (!lucideCache.has(name)) {
    const file = await readFile(
      path.join(NODE_MODULES, "lucide-static/icons", `${name}.svg`),
      "utf8",
    );
    lucideCache.set(name, /<svg[^>]*>([\s\S]*)<\/svg>/.exec(file)[1].trim());
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${attrs}>${lucideCache.get(name)}</svg>`;
}

const brand = (d, attrs = "") =>
  `<svg viewBox="0 0 24 24" fill="currentColor" ${attrs}><path d="${d}"/></svg>`;

async function skillIcon(name) {
  let key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  key = ALIASES[key] ?? key;
  if (BRANDS[key])
    return brand(
      BRANDS[key].path,
      `class="si" style="color:${BRANDS[key].dark}"`,
    );
  if (CONCEPTS[key]) return lucide(CONCEPTS[key], `class="si concept"`);
  return `<span class="si tile">${esc(name[0].toUpperCase())}</span>`;
}

// The photo as grey rectangles: one path per shade, each row's runs merged.
// Runs overlap a little so no seams show between them.
async function avatarMosaic() {
  const size = 72;
  const { data } = await sharp(path.join(ASSETS, "src/profile.jpg"))
    .resize(size, size)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const levels = 40;
  const shade = (v) => Math.round((v / 255) * (levels - 1));
  const paths = new Map();
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      const s = shade(data[y * size + x]);
      let end = x + 1;
      while (end < size && shade(data[y * size + end]) === s) end++;
      const d = paths.get(s) ?? [];
      d.push(`M${x} ${y}h${end - x + 0.4}v1.4h-${end - x + 0.4}z`);
      paths.set(s, d);
      x = end;
    }
  }
  const body = [...paths]
    .sort(([a], [b]) => a - b)
    .map(([s, d]) => {
      const v = Math.round((s / (levels - 1)) * 255)
        .toString(16)
        .padStart(2, "0");
      return `<path fill="#${v}${v}${v}" d="${d.join("")}"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="42" height="42">${body}</svg>`;
}

// Faint 32px graph-paper grid behind everything, centred like the site's.
function gridLines(width, height) {
  const lines = [];
  const x0 = ((width / 2) % 32) - 0.5;
  for (let x = x0; x < width; x += 32)
    lines.push(`<rect x="${x}" y="0" width="1" height="${height}"/>`);
  for (let y = 0; y < height; y += 32)
    lines.push(`<rect x="0" y="${y}" width="${width}" height="1"/>`);
  return `<svg class="grid" width="${width}" height="${height}" fill="rgba(255,255,255,0.045)">${lines.join("")}</svg>`;
}

// ── Page ──

const font = (family, weight, pkg, file) =>
  `@font-face{font-family:${family};font-weight:${weight};src:url(${pathToFileURL(path.join(NODE_MODULES, "@fontsource", pkg, "files", file))})}`;

const CSS = (m) => `
${font("Geist", 400, "geist", "geist-latin-400-normal.woff")}
${font("Geist", 500, "geist", "geist-latin-500-normal.woff")}
${font("Mono", 400, "geist-mono", "geist-mono-latin-400-normal.woff")}
${font("Mono", 600, "geist-mono", "geist-mono-latin-600-normal.woff")}
${font("Caveat", 500, "caveat", "caveat-latin-500-normal.woff")}
*{box-sizing:border-box;margin:0;padding:0;animation:none!important}
html,body{background:#060606}
body{font-family:Geist,sans-serif;line-height:1.5;color:#ededed}
a{color:inherit;text-decoration:none}
svg{display:block;flex-shrink:0}
.panel{position:relative;padding:${m ? "20px 16px" : "32px"};overflow:hidden}
.grid{position:absolute;left:0;top:0}
.mono{font-family:Mono,monospace}

.site{position:relative;max-width:760px;margin:0 auto ${m ? 20 : 32}px;padding:0 4px;display:flex;align-items:center;justify-content:space-between}
.ga{font:600 12px/1.5 Mono;letter-spacing:.2em;color:#fff}
.site nav{display:flex;align-items:center;gap:4px}
.site nav span{border-radius:999px;padding:6px 12px;font:400 11px/1.5 Mono;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.7)}
.site nav .pill{border:1px solid rgba(255,255,255,.25);padding:6px 16px;color:#fff}

.card{position:relative;max-width:760px;margin:0 auto;border:1px solid rgba(237,237,237,.1);border-radius:12px;background:#0a0a0a;padding:${m ? "48px 20px 32px" : "64px 48px 40px"}}
.corner{position:absolute;width:12px;height:12px;border-color:rgba(237,237,237,.25);border-style:solid;border-width:0}
.tl{left:12px;top:12px;border-left-width:1px;border-top-width:1px}
.tr{right:12px;top:12px;border-right-width:1px;border-top-width:1px}
.bl{left:12px;bottom:12px;border-left-width:1px;border-bottom-width:1px}
.br{right:12px;bottom:12px;border-right-width:1px;border-bottom-width:1px}

.head{display:flex;${m ? "flex-direction:column;gap:16px" : "justify-content:space-between;align-items:flex-start;gap:24px"}}
.who{display:flex;align-items:center;gap:14px}
.avatar{width:44px;height:44px;border-radius:50%;border:1px solid rgba(237,237,237,.1);overflow:hidden}
h1{font-size:${m ? 17 : 18}px;font-weight:500;letter-spacing:-.015em;line-height:1.5}
.sub{margin-top:2px;font-size:${m ? 14 : 14.5}px;color:#8a8a8a}
.sub span{color:#5e5e5e}
.icons{display:flex;flex-wrap:wrap;${m ? "margin-left:-6px;gap:2px" : "gap:4px;padding-top:4px"}}
.icons span{display:grid;place-items:center;width:32px;height:32px;color:#8a8a8a}
.icons svg{width:16px;height:16px}

.bio{margin-top:24px;font-size:${m ? 14.5 : 15.5}px;line-height:1.75;color:#a1a1a1}
.bio p+p{margin-top:14px}
.ink{color:#ededed}
.link{color:#ededed;text-decoration:underline;text-decoration-color:#5e5e5e;text-decoration-thickness:1px;text-underline-offset:3px}

.buttons{margin-top:28px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.btn{display:flex;align-items:center;gap:6px;border-radius:8px;padding:8px 14px;font-size:${m ? 13.5 : 14}px;font-weight:500}
.btn svg{width:15px;height:15px}
.solid{background:#ededed;color:#0a0a0a}
.outline{border:1px solid rgba(237,237,237,.15);background:#161616}
.otw{margin-left:12px;display:${m ? "none" : "flex"};align-items:center;gap:4px}
.otw svg{width:56px;height:28px;overflow:visible;color:#8a8a8a}
.otw span{margin-top:-20px;font:500 21px/1 Caveat;color:#8a8a8a;white-space:nowrap;transform:rotate(-6deg)}

.sections{margin-top:48px}
section+section{margin-top:48px}
.sh{margin-bottom:16px;display:flex;align-items:baseline;justify-content:space-between;gap:16px}
h2{font-size:15px;font-weight:500;letter-spacing:-.01em}
.action{display:flex;align-items:center;gap:4px;font-size:${m ? 13 : 13.5}px;color:#8a8a8a}
.action svg{width:12px;height:12px}

.scroll{overflow:hidden;padding-bottom:6px}
.year{min-width:560px${m ? ";width:560px;margin-left:calc(100% - 560px)" : ""}}
.months,.squares{display:grid;gap:${m ? 2 : 3}px}
.months{height:12px;margin-bottom:6px}
.months span{overflow:hidden;white-space:nowrap;font:400 10px/12px Mono;color:#5e5e5e}
.squares{grid-auto-flow:column;grid-template-rows:repeat(7,auto)}
.squares span{aspect-ratio:1;border-radius:2px}
.h0{background:rgba(255,255,255,.06)}.h1{background:#333}.h2{background:#5f5f5f}.h3{background:#9a9a9a}.h4{background:#ededed}
.meta{margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px}
.meta p,.meta a{font:400 11px/1.5 Mono;color:#8a8a8a}
.meta a{text-decoration:underline;text-decoration-color:rgba(237,237,237,.2);text-underline-offset:2px}
.legend{display:flex;align-items:center;gap:6px;font:400 10px/1.5 Mono;color:#5e5e5e}
.legend i{display:flex;gap:2px}
.legend b{width:9px;height:9px;border-radius:2px}
.meta>div{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px}

.timeline{position:relative;height:8px;margin-bottom:14px;display:${m ? "none" : "block"}}
.timeline .line{position:absolute;left:0;right:50%;top:3.5px;height:1px;background:linear-gradient(to right,#ededed 0%,#333 70%)}
.timeline .dots{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;align-items:center}
.dot{display:block;position:relative;width:6px;height:6px;border-radius:50%;background:rgba(237,237,237,.3)}
.dot.now{background:#ededed}
.dot.now::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:rgba(237,237,237,.15)}
.roles{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.roles li{list-style:none;padding-right:${m ? 0 : 16}px}
.company{font-size:${m ? 14 : 14.5}px;font-weight:500}
.role{margin-top:2px;font-size:13px;color:#8a8a8a}
.dates{margin-top:4px;font:400 11.5px/1.5 Mono;letter-spacing:.02em;color:#5e5e5e}

dl>div{display:flex;${m ? "flex-direction:column;gap:6px" : "align-items:baseline;gap:20px"}}
dl>div+div{margin-top:12px}
dt{width:112px;flex-shrink:0;font-size:${m ? 13 : 13.5}px;color:#8a8a8a}
dd{display:flex;flex-wrap:wrap;gap:8px 12px}
.chip{display:flex;align-items:center;gap:6px;font-size:${m ? 13 : 14}px;color:#a1a1a1}
.si{width:15px;height:15px}
.concept{color:#8a8a8a}
.tile{display:grid;place-items:center;border-radius:3px;background:rgba(237,237,237,.1);font:400 8px/1 Mono;color:#a1a1a1}

.foot{position:relative;max-width:760px;margin:24px auto 0;padding:0 4px;display:flex;justify-content:space-between;font:400 10px/1.5 Mono;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.5)}
`;

async function page(layout, activity, avatar) {
  const m = layout.mobile;
  const icon = async (key) =>
    key === "mail"
      ? (await lucide("mail")).replace('stroke-width="2"', 'stroke-width="1.7"')
      : brand(PROFILES[key]);

  const weeks =
    activity?.weeks ??
    Array.from({ length: 53 }, () => ({ levels: Array(7).fill(0) }));
  const cols = `grid-template-columns:repeat(${weeks.length},minmax(0,1fr))`;
  const months = activity
    ? monthLabels(weeks)
        .map(
          (l) =>
            `<span style="grid-column:${l.col + 1} / span ${l.span}">${l.name}</span>`,
        )
        .join("")
    : "";
  const squares = weeks
    .flatMap((w) =>
      w.levels.map((level) =>
        level === null ? "<i></i>" : `<span class="h${level}"></span>`,
      ),
    )
    .join("");
  const total = activity
    ? `${activity.total.toLocaleString("en-GB")} contribution${activity.total === 1 ? "" : "s"} in the last year`
    : "Loading contributions…";

  const chevron = await lucide("chevron-down");
  const skillRows = [];
  for (const [category, items] of skills) {
    const chips = [];
    for (const item of items)
      chips.push(
        `<span class="chip">${await skillIcon(item)}${esc(item)}</span>`,
      );
    skillRows.push(
      `<div><dt>${esc(category)}</dt><dd>${chips.join("")}</dd></div>`,
    );
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS(m)}</style></head><body>
<div class="panel" style="width:${layout.width}px">
<div id="grid"></div>
<div class="site"><span class="ga">GA</span><nav><span>Cinema</span><span>Shop</span><span class="pill">Links ↗</span></nav></div>
<main class="card">
<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
<header data-block>
  <div class="head">
    <div class="who"><div class="avatar">${avatar}</div><div><h1>Gafar Aleshe</h1><p class="sub">Software engineer <span>/ @gafaraleshe</span></p></div></div>
    <div class="icons">${(await Promise.all(profiles.map(async ([, key]) => `<span>${await icon(key)}</span>`))).join("")}</div>
  </div>
</header>
<div class="bio">
  <p data-block>Hey, I'm Gafar — a software engineer based in <span class="ink">Portsmouth, UK</span>. I work across full-stack and frontend, building accessible, type-safe web apps with TypeScript, React, Next.js and Node.js.</p>
  <p data-block>I've shipped 25+ responsive sites and apps at <span class="link">FrontToBack</span>, and I'm building <span class="link">Hermite Labs</span> — software for creative businesses, starting with the <span class="link">HermiteFlow</span> CRM and invoicing app.</p>
  <p data-block>Away from the editor I shoot photo and film as <span class="ink">SHOTBYGAFAR</span> — that side lives in the <span class="link">cinema</span>, with my LUTs and presets in the <span class="link">shop</span>.</p>
</div>
<div class="buttons" data-block>
  <span class="btn solid">${await lucide("mail")}Email me</span>
  <span class="btn outline">${await lucide("download")}Résumé</span>
  <div class="otw"><svg viewBox="0 0 64 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M60 22C46 30 22 28 6 12"/><path d="M5 22L5 11L16 10"/></svg><span>open to work</span></div>
</div>
<div class="sections">
<section data-block>
  <div class="sh"><h2>Activity</h2></div>
  <div class="scroll"><div class="year">
    <div class="months" style="${cols}">${months}</div>
    <div class="squares" style="${cols}">${squares}</div>
  </div></div>
  <div class="meta"><p>${total}</p><div><span class="legend">Less<i>${[0, 1, 2, 3, 4].map((h) => `<b class="h${h}"></b>`).join("")}</i>More</span><a>github.com/${USERNAME} ↗</a></div></div>
</section>
<section data-block>
  <div class="sh"><h2>Experience</h2><span class="action">See more${chevron}</span></div>
  <div class="timeline"><div class="line"></div><div class="dots">${experience.map((_, i) => `<div><span class="dot${i === 0 ? " now" : ""}"></span></div>`).join("")}</div></div>
  <ol class="roles">${experience.map((e) => `<li><p class="company">${esc(e.company)}</p><p class="role">${esc(e.role)}</p><p class="dates">${e.start} – ${e.end}</p></li>`).join("")}</ol>
</section>
<section data-block>
  <div class="sh"><h2>Skills</h2></div>
  <dl>${skillRows.join("")}</dl>
</section>
</div>
</main>
<div class="foot" data-block><span>Portsmouth, United Kingdom</span><span>All Links →</span></div>
</div></body></html>`;
}

// ── Render ──

// Rounds pdftocairo's coordinates (in pt) and sizes the SVG in px.
// Crops the full-panel SVG (in pt) to one strip and sizes it in px. Strip
// edges are kept to multiples of 4px so they are whole points.
function tidy(svg, width, top, height) {
  const sized = svg.replace(
    /<svg ([^>]*?)width="[^"]*" height="[^"]*" viewBox="[^"]*"/,
    `<svg $1width="${width}" height="${height}" viewBox="0 ${top * 0.75} ${width * 0.75} ${height * 0.75}"`,
  );
  return optimize(sized, {
    multipass: true,
    floatPrecision: 2,
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { removeViewBox: false } },
      },
    ],
  }).data;
}

const four = (n) => Math.round(n / 4) * 4;

async function renderLayout(browser, name, layout, activity, avatar, tmp) {
  const html = await page(layout, activity, avatar);
  const file = path.join(tmp, `${name}.html`);
  await writeFile(file, html);

  const tab = await browser.newPage({
    viewport: { width: layout.width, height: 800 },
  });
  await tab.goto(pathToFileURL(file).href);
  await tab.evaluate(() => document.fonts.ready);
  const { natural, blocks } = await tab.evaluate(() => ({
    natural: document.querySelector(".panel").getBoundingClientRect().height,
    blocks: [...document.querySelectorAll("[data-block]")].map((el, i) => {
      el.dataset.block = i;
      const r = el.getBoundingClientRect();
      return [r.top, r.bottom];
    }),
  }));
  const height = Math.ceil(natural / 4) * 4;
  if (blocks.length !== STRIPS.length)
    throw new Error(`${blocks.length} blocks for ${STRIPS.length} strips`);
  await tab.evaluate(
    ([h, grid]) => {
      const panel = document.querySelector(".panel");
      panel.style.height = `${h}px`;
      document.getElementById("grid").outerHTML = grid;
    },
    [height, gridLines(layout.width, height)],
  );

  const cuts = [0];
  for (let i = 1; i < blocks.length; i++)
    cuts.push(four((blocks[i - 1][1] + blocks[i][0]) / 2));
  cuts.push(height);

  // Each strip prints the whole panel with the other strips' blocks hidden,
  // so the PDF doesn't carry them, and is then cropped to its band. Cropping
  // in the SVG rather than clipping in the page keeps the edges exact.
  await tab.addStyleTag({
    content: `@page{size:${layout.width}px ${height}px;margin:0}`,
  });
  const out = path.join(ASSETS, name);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const strips = [];
  for (let i = 0; i < STRIPS.length; i++) {
    const [top, bottom] = [cuts[i], cuts[i + 1]];
    const h = bottom - top;
    await tab.evaluate((shown) => {
      for (const el of document.querySelectorAll("[data-block]"))
        el.style.visibility = el.dataset.block === shown ? "" : "hidden";
    }, String(i));
    const pdf = path.join(tmp, `${name}-${i}.pdf`);
    await tab.pdf({
      path: pdf,
      width: `${layout.width}px`,
      height: `${height}px`,
      printBackground: true,
      pageRanges: "1",
    });
    const svgFile = path.join(tmp, `${name}-${i}.svg`);
    await run("pdftocairo", ["-svg", "-f", "1", "-l", "1", pdf, svgFile]);
    const svg = tidy(await readFile(svgFile, "utf8"), layout.width, top, h);
    if (svg.includes("<image"))
      throw new Error(`${name}/${STRIPS[i].name} has a raster image`);
    const fileName = `${String(i + 1).padStart(2, "0")}-${STRIPS[i].name}.svg`;
    await writeFile(path.join(out, fileName), svg);
    strips.push(fileName);
  }
  await tab.close();
  console.log(`${name}: ${layout.width}x${height}, cuts ${cuts.join(" ")}`);
  return strips;
}

function readme(files, activity) {
  const alt = (strip) =>
    strip.alt ??
    (activity
      ? `Activity: ${activity.total.toLocaleString("en-GB")} contributions on GitHub in the last year`
      : "Activity: GitHub contributions in the last year");
  const rows = STRIPS.map(
    (strip, i) =>
      `<a href="${strip.href}"><picture><source media="(max-width: ${MOBILE_MAX}px)" srcset="assets/mobile/${files.mobile[i]}"><img align="left" src="assets/desktop/${files.desktop[i]}" alt="${esc(alt(strip)).replace(/"/g, "&quot;")}"></picture></a>`,
  );
  return `<!--
  Generated by scripts/build.mjs: the top of gafaraleshe.com as stacked image
  strips (desktop and mobile). Edit the script, then run npm run build.
-->

<p>
${rows.join("\n")}
</p>
`;
}

const tmp = path.join(os.tmpdir(), `readme-build-${process.pid}`);
await mkdir(tmp, { recursive: true });
const activity = await fetchActivity();
const avatar = await avatarMosaic();
const browser = await chromium.launch();
try {
  const files = {};
  for (const [name, layout] of Object.entries(LAYOUTS))
    files[name] = await renderLayout(
      browser,
      name,
      layout,
      activity,
      avatar,
      tmp,
    );
  await writeFile(path.join(ROOT, "README.md"), readme(files, activity));
} finally {
  await browser.close();
  if (!process.env.KEEP_TMP) await rm(tmp, { recursive: true, force: true });
  else console.log(tmp);
}
