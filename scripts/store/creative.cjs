// App Store creative assets (iOS 27 product page header and search
// results): 3D views of the three takeoffs on brand green.
// See shots.cjs for the setup.
//   node scripts/store/creative.cjs docs/store-listing/creative
const { chromium } = require('playwright');
const path = require('path');
const seed = require('./seed.cjs');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 1100 }, deviceScaleFactor: 3 })).newPage();
  await p.goto('http://localhost:4173/');
  await p.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem('a2calc:' + k, JSON.stringify({ v: 1, data: v })); }, seed);
  const grab = async (route, zoom = 0) => {
    await p.goto('http://localhost:4173' + route);
    await p.getByRole('button', { name: '3D', exact: true }).first().click();
    await p.waitForTimeout(3000);
    const c = p.locator('.three canvas');
    if (zoom) { await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -zoom / 6); await p.waitForTimeout(80); } await p.waitForTimeout(600); }
    return (await c.screenshot()).toString('base64');
  };
  const wood = await grab('/takeoff/framing', 250), block = await grab('/takeoff/grout', 250), conc = await grab('/takeoff/concrete', 700);
  const card = (img, cls) => `<div class="card ${cls}"><img src="data:image/png;base64,${img}"></div>`;
  const page = (W, H, head, sub, k, g) => `<!doctype html><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;800&display=swap');
*{margin:0;box-sizing:border-box}body{width:${W}px;height:${H}px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;
background:radial-gradient(90% 120% at 50% 0%,#0a8a4c,#006839 55%,#00431f);display:flex;flex-direction:column;align-items:center}
h1{font-size:${170 * k}px;font-weight:800;letter-spacing:-.02em;margin-top:${120 * k}px;text-align:center}
p{font-size:${78 * k}px;font-weight:500;opacity:.88;margin-top:${24 * k}px;text-align:center}
.row{position:relative;width:100%;flex:1}
.card{position:absolute;border-radius:${48 * k}px;overflow:hidden;background:#f3f6f4;box-shadow:0 ${40 * k}px ${110 * k}px rgba(0,0,0,.4)}
.card img{display:block;width:100%}
.l{width:${g.s}px;left:50%;margin-left:${-g.off - g.s}px;top:${g.top + g.drop}px;transform:rotate(-4deg)}
.r{width:${g.s}px;left:50%;margin-left:${g.off}px;top:${g.top + g.drop}px;transform:rotate(4deg)}
.c{width:${g.c}px;left:50%;margin-left:${-g.c / 2}px;top:${g.top}px;z-index:2}</style>
<h1>${head}</h1><p>${sub}</p><div class="row">${card(block, 'l')}${card(conc, 'r')}${card(wood, 'c')}</div>`;
  const shoot = async (W, H, head, sub, k, g, file) => {
    const f = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
    await f.setContent(page(W, H, head, sub, k, g), { waitUntil: 'networkidle' });
    await f.screenshot({ path: path.join(out, file) });
  };
  await shoot(3840, 1646, 'Takeoffs you can see', 'Stud walls, block walls and concrete, in 3D.', 0.62, { c: 1850, s: 1450, off: 560, top: 30, drop: 90 }, 'header-3840x1646.png');
  await shoot(3840, 2560, 'Takeoffs you can see', 'Feet-inch calculator. Stud, block and concrete takeoffs in 3D.', 1, { c: 2500, s: 1750, off: 750, top: 230, drop: 260 }, 'search-3840x2560.png');
  await b.close();
})();
