// Google Play feature graphic (1024x500): icon, name and two 3D views.
// See shots.cjs for the setup.
const { chromium } = require('playwright');
const fs = require('fs');
const seed = require('./seed.cjs');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://localhost:4173/');
  await p.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem('a2calc:' + k, JSON.stringify({ v: 1, data: v })); }, seed);
  const grab = async (path) => { await p.goto('http://localhost:4173' + path); await p.getByRole('button', { name: '3D', exact: true }).first().click(); await p.waitForTimeout(2500); return (await p.locator('.three canvas').screenshot({ omitBackground: true })).toString('base64'); };
  const wood = await grab('/takeoff/framing'), block = await grab('/takeoff/grout');
  const icon = fs.readFileSync(process.argv[3]).toString('base64');
  const f = await (await b.newContext({ viewport: { width: 1024, height: 500 } })).newPage();
  await f.setContent(`<!doctype html><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;800&display=swap');
*{margin:0}body{width:1024px;height:500px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;background:radial-gradient(120% 120% at 15% 0%,#0a8a4c,#006839 50%,#004a29);position:relative}
.t{position:absolute;left:52px;top:105px;width:380px}.t img{width:96px;height:96px;border-radius:22px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
h1{font-size:44px;font-weight:800;letter-spacing:-.02em;margin-top:22px;line-height:1}p{font-size:23px;font-weight:500;opacity:.88;margin-top:14px;line-height:1.3}
.a,.b{position:absolute;border-radius:18px;background:#f3f6f4;box-shadow:0 14px 40px rgba(0,0,0,.35);overflow:hidden}.a img,.b img{display:block;width:100%}
.a{width:380px;right:130px;top:48px;transform:rotate(-3deg)}.b{width:300px;right:-10px;top:225px;transform:rotate(4deg)}</style>
<div class="a"><img src="data:image/png;base64,${wood}"></div><div class="b"><img src="data:image/png;base64,${block}"></div>
<div class="t"><img src="data:image/png;base64,${icon}"><h1>A2 Takeoff Calc</h1><p>Feet-inch calculator. Stud, block and concrete takeoffs, in 3D.</p></div>`, { waitUntil: 'networkidle' });
  await f.screenshot({ path: out + '/feature-graphic.png' });
  await b.close();
})();
