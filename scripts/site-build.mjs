#!/usr/bin/env node
// Builds calc.a2cons.com (GitHub Pages) into _site/: each page in
// site/pages/ wrapped in the shared header and footer, the terms and
// privacy pages made from TERMS.md and PRIVACY.md (the same files the app
// shows), plus site.css, images and videos. No dependencies.
//
//   node scripts/site-build.mjs          # then: npx serve _site (or any static server)
//
// When the App Store version goes live, set APP_STORE_LIVE to true: the
// badge replaces "Coming soon" and Safari shows its app banner.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'site');
const OUT = join(ROOT, '_site');
const ORIGIN = 'https://calc.a2cons.com';
const APP_STORE_LIVE = true;
const APP_STORE = 'https://apps.apple.com/app/id6831422602';
const PLAY = 'https://play.google.com/store/apps/details?id=com.a2cons.calc';
const YEAR = 2026;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const badges = `<div class="badges">
  ${APP_STORE_LIVE
    ? `<a href="${APP_STORE}"><img src="/img/app-store.svg" width="132" height="44" alt="Download on the App Store"></a>`
    : '<span class="soon">Coming soon<small>to the App Store, iPhone, iPad and Mac</small></span>'}
  <a href="${PLAY}"><img src="/img/google-play.png" width="148" height="44" alt="Get it on Google Play"></a>
</div>`;

function layout({ path, title, description, section, head = '', body, scripts = '' }) {
  const url = ORIGIN + path;
  const nav = (href, label, key, cls = '') =>
    `<a href="${href}"${cls ? ` class="${cls}"` : ''}${section === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="stylesheet" href="/site.css">
<meta name="theme-color" content="#006839">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="A2 Calc">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${ORIGIN}/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${APP_STORE_LIVE ? '<meta name="apple-itunes-app" content="app-id=6831422602">\n' : ''}${head}
</head>
<body>
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="/"><img src="/img/icon-64.png" width="32" height="32" alt=""><span>A2 Calc</span></a>
    <nav class="top-nav" aria-label="Site">
      ${nav('/#features', 'Features', 'features', 'wide')}
      ${nav('/guide/', 'Guide', 'guide')}
      ${nav('/support/', 'Support', 'support')}
      <a class="top-get" href="/#get">Get the app</a>
    </nav>
  </div>
</header>
${body}
<footer class="foot">
  <div class="wrap foot-row">
    <div class="foot-brand">
      <img src="/img/icon-64.png" width="40" height="40" alt="">
      <div><strong>A2 Calc</strong><span>Measure twice. Order once.</span></div>
    </div>
    <nav class="foot-nav" aria-label="More">
      <a href="/guide/">Guide</a>
      <a href="/support/">Support</a>
      <a href="/terms/">Terms of Use</a>
      <a href="/privacy/">Privacy Policy</a>
      <a href="https://github.com/a2cons-com/a2calc">Source code</a>
    </nav>
    <p class="foot-copy">&copy; ${YEAR} <a href="https://labs.a2cons.com">A2 Labs</a>. Built for the crews of <a href="https://a2cons.com">A2 Construction</a>.</p>
  </div>
</footer>
${scripts}
</body>
</html>
`;
}

// A page file starts with a comment holding its settings, one "key: value"
// per line (path, title, description, section), then the <main> markup;
// an optional <script> block at the end goes before </body>.
function page(file) {
  const text = readFileSync(join(SRC, 'pages', file), 'utf8');
  const [, meta, rest] = text.match(/^<!--([\s\S]*?)-->\s*([\s\S]*)$/);
  const opts = Object.fromEntries(meta.trim().split('\n').map((l) => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
  const at = rest.indexOf('<script');
  const body = (at < 0 ? rest : rest.slice(0, at)).replaceAll('{{badges}}', badges);
  return { ...opts, body, scripts: at < 0 ? '' : rest.slice(at) };
}

// The legal Markdown: "# " title, "Effective ..." line, "## " headings,
// paragraphs, "- " lists and **bold**, as src/lib/components/LegalText.svelte.
function legal(md, path, description) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/support@a2cons\.com/g, '<a href="mailto:support@a2cons.com">support@a2cons.com</a>')
    .replace(/github\.com\/a2cons-com\/a2calc\/issues/g, '<a href="https://github.com/a2cons-com/a2calc/issues">github.com/a2cons-com/a2calc/issues</a>')
    .replace(/\(see LICENSE\)/, '(see <a href="https://github.com/a2cons-com/a2calc/blob/main/LICENSE">LICENSE</a>)');
  let title = '', html = '';
  for (const chunk of md.split(/\n\s*\n/)) {
    const lines = chunk.trim().split('\n');
    if (!lines[0]) continue;
    if (lines[0].startsWith('# ')) title = lines[0].slice(2);
    else if (lines[0].startsWith('## ')) html += `<h2>${inline(lines[0].slice(3))}</h2>\n`;
    else if (/^Effective /.test(lines[0])) html += `<p class="meta">${inline(lines[0])}</p>\n`;
    else if (lines.every((l) => l.startsWith('- '))) html += `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>\n`;
    else html += `<p>${inline(lines.join(' '))}</p>\n`;
  }
  return layout({ path, title: `${title} · A2 Calc`, description, section: path.slice(1, -1),
    body: `<main class="wrap page">\n<h1>${esc(title)}</h1>\n${html}</main>` });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const write = (rel, html) => {
  mkdirSync(dirname(join(OUT, rel)), { recursive: true });
  writeFileSync(join(OUT, rel), html);
};
const paths = [];
for (const file of readdirSync(join(SRC, 'pages'))) {
  const p = page(file);
  write(p.path === '/' ? 'index.html' : p.path.endsWith('/') ? `${p.path.slice(1)}index.html` : p.path.slice(1), layout(p));
  if (p.path.endsWith('/')) paths.push(p.path);
}
write('terms/index.html', legal(readFileSync(join(ROOT, 'TERMS.md'), 'utf8'), '/terms/',
  'A2 Calc terms of use: an estimating aid, free and as is; check every number before you build, order or bid.'));
write('privacy/index.html', legal(readFileSync(join(ROOT, 'PRIVACY.md'), 'utf8'), '/privacy/',
  'A2 Calc privacy policy: the app collects nothing. No accounts, ads, analytics or tracking.'));
paths.push('/terms/', '/privacy/');

for (const f of ['site.css', 'favicon.svg', 'CNAME', 'img', 'video']) cpSync(join(SRC, f), join(OUT, f), { recursive: true });
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  paths.sort().map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`_site/: ${paths.length} pages`);
