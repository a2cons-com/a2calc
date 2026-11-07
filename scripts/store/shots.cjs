// Store screenshots for the App Store and Google Play: the app (built and
// served by `npx vite preview --port 4173`) with the example data in
// seed.cjs, at each device size, framed with a caption on brand green.
//
//   npm i --no-save playwright@1.64.0     # with its own chromium
//   node scripts/store/shots.cjs docs/store-listing/screenshots APP_IPHONE_67
//   (APP_IPAD_PRO_3GEN_129, APP_DESKTOP; play_phone, play_tablet7,
//   play_tablet10 go to docs/store-listing/play/<phone|tablet7|tablet10>)
//   node scripts/store/feature.cjs docs/store-listing/play <icon.png>
// RAW=<dir> also saves each bare app screenshot there (raw-<id>.png), for
// the website's device frames.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const seed = require('./seed.cjs');
const [out, devName] = process.argv.slice(2);
const DEV = {
  // canvas size, CSS viewport of the app, its scale, caption scale
  APP_IPHONE_67:         { W: 1320, H: 2868, vw: 400, vh: 790, dpr: 2.8, f: 1 },
  APP_IPAD_PRO_3GEN_129: { W: 2048, H: 2732, vw: 860, vh: 1000, dpr: 2, f: 1.3 },
  APP_DESKTOP:           { W: 2880, H: 1800, vw: 600, vh: 760, dpr: 2, f: 1.3, side: true },
  play_phone:            { W: 1080, H: 1920, vw: 380, vh: 640, dpr: 2.4, f: 0.78 },
  play_tablet7:          { W: 1200, H: 1920, vw: 600, vh: 760, dpr: 1.75, f: 0.85 },
  play_tablet10:         { W: 1600, H: 2560, vw: 800, vh: 960, dpr: 1.75, f: 1.05 },
}[devName];
const SHOTS = [
  { id: '01-calc', path: '/', title: 'Feet, inches & fractions', sub: 'Type it like you say it. 5′ 3½″ + 2′ 10¾″ just works.',
    go: async (p) => { await p.keyboard.type(`12'6"*4=`); await p.keyboard.press('Escape'); await p.keyboard.type(`5'3"1/2+2'10"3/4=`); } },
  { id: '02-framing-3d', path: '/takeoff/framing', title: 'Your walls, in 3D', sub: 'Every stud, plate and header, framed around your doors and windows.', view: '3D', scroll: 'plan' },
  { id: '03-framing-wall', path: '/takeoff/framing', title: 'Drag a window, see it reframe', sub: 'Kings, jacks, header and cripples move with it.', scroll: 'Wall 1' },
  { id: '04-framing-plan', path: '/takeoff/framing', title: 'A dimensioned floor plan', sub: 'Tap a wall to edit it. The full cut list and what to buy.' },
  { id: '05-grout-3d', path: '/takeoff/grout', title: 'Block walls, block by block', sub: 'Grouted cells and lintels over every door and window.', view: '3D', scroll: 'plan' },
  { id: '06-grout-wall', path: '/takeoff/grout', title: 'Grout you can order', sub: 'Cells at jambs and corners, lintels grouted or poured, block count.', scroll: 'Wall 1' },
  { id: '07-concrete', path: '/takeoff/concrete', title: 'Concrete in 3D', sub: 'Slabs, footings, walls and piers, with waste, rounded to the yard.', view: '3D', zoom: 900 },
  { id: '08-free', path: '/takeoff', title: 'Free. No ads. No account.', sub: 'Concrete, block and framing takeoffs. Nothing leaves your device.' },
];
const html = (img, s, d) => `<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;800&display=swap');
*{margin:0;box-sizing:border-box} body{width:${d.W}px;height:${d.H}px;overflow:hidden;font-family:Inter,system-ui,sans-serif;
background:radial-gradient(120% 70% at 20% 0%,#0a8a4c 0%,#006839 45%,#004a29 100%);color:#fff;display:flex;flex-direction:column;align-items:center}
.cap{padding:${d.wide ? 70 : 120 * d.f}px ${80 * d.f}px 0;text-align:center}
h1{font-size:${(d.wide ? 92 : 104) * d.f}px;font-weight:800;letter-spacing:-0.02em;line-height:1.05}
p{margin-top:${22 * d.f}px;font-size:${(d.wide ? 42 : 46) * d.f}px;font-weight:500;line-height:1.3;opacity:.86;max-width:${d.wide ? 2200 : d.W - 160 * d.f}px;margin-left:auto;margin-right:auto}
.screen{margin-top:${(d.wide ? 60 : 80) * d.f}px;width:${Math.round(d.vw * d.dpr)}px;height:${Math.round(d.vh * d.dpr)}px;border-radius:${56 * d.f}px;overflow:hidden;
box-shadow:0 ${30 * d.f}px ${90 * d.f}px rgba(0,0,0,.45),0 0 0 ${10 * d.f}px rgba(255,255,255,.12)}
.screen img{width:100%;height:100%;display:block}
body.side{flex-direction:row;justify-content:center;gap:160px}
.side .cap{text-align:left;padding:0;width:1100px} .side h1{font-size:130px} .side p{font-size:58px;margin-left:0;max-width:1100px}
.side .screen{margin-top:0;height:auto;border-radius:28px} .side .screen img{height:${Math.round(d.vh * d.dpr)}px}
.bar{height:64px;background:#e9ecea;display:flex;gap:18px;align-items:center;padding:0 26px} .bar i{width:24px;height:24px;border-radius:50%;background:#ff5f57} .bar i:nth-child(2){background:#febc2e} .bar i:nth-child(3){background:#28c840}
</style></head><body class="${d.side ? 'side' : ''}"><div class="cap"><h1>${s.title}</h1><p>${s.sub}</p></div><div class="screen">${d.side ? '<div class="bar"><i></i><i></i><i></i></div>' : ''}<img src="data:image/png;base64,${img.toString('base64')}"></div></body></html>`;
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const touch = devName.includes('PHONE') || devName.includes('play');
  const ctx = await b.newContext({ viewport: { width: DEV.vw, height: DEV.vh }, deviceScaleFactor: DEV.dpr, isMobile: touch, hasTouch: touch });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/');
  const frame = await (await b.newContext({ viewport: { width: DEV.W, height: DEV.H }, deviceScaleFactor: 1 })).newPage();
  const dir = path.join(out, devName.replace(/^play_/, '')); fs.mkdirSync(dir, { recursive: true });
  for (const s of SHOTS) {
    await p.evaluate((seed) => { localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem('a2calc:' + k, JSON.stringify({ v: 1, data: v })); }, seed);
    await p.goto('http://localhost:4173' + s.path); await p.addStyleTag({ content: '.page-head{background:var(--bg)!important}' }); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(600);
    if (s.go) await s.go(p);
    if (s.view) { await p.getByRole('button', { name: s.view, exact: true }).first().click(); await p.waitForTimeout(2500);
      if (s.zoom) { const c = p.locator('.three canvas'); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -s.zoom / 6); await p.waitForTimeout(80); } await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500); } }
    if (s.scroll) { await p.getByText(new RegExp('^' + s.scroll + '$', 'i')).first().evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 70)); await p.waitForTimeout(400); }
    await p.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflowX !== 'visible' && e !== document.documentElement && e !== document.body) e.scrollLeft = 0; }));
    const img = await p.screenshot();
    if (process.env.RAW) fs.writeFileSync(path.join(process.env.RAW, `raw-${s.id}.png`), img);
    await frame.setContent(html(img, s, DEV), { waitUntil: 'networkidle' });
    await frame.screenshot({ path: path.join(dir, `store-${s.id}.png`) });
    console.log(devName, s.id);
  }
  await b.close();
})();
