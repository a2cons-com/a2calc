// Frames for the search results video: a stud wall takeoff done by hand on
// a phone screen (390x844 CSS px, DSF 3), every frame with how long it
// stays on screen, where a finger touches and which step it belongs to.
//
//   npx vite preview --port 4190
//   node scripts/store/capture-flow.mjs <frames-dir>     (playwright-core)
//
// Writes <dir>/flow/NNNN.png and <dir>/flow/timeline.json.
// Project saving and export are hidden (not in the release this is for).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = `${process.argv[2]}/flow`;
const URL = process.env.URL ?? 'http://localhost:4190';
mkdirSync(OUT, { recursive: true });
const S = (o) => JSON.stringify({ v: 1, data: o });
const seed = {
	prefs: { disclaimerSeen: true, precision: 16 },
	wall: {
		member: '2x4', spacing: 16, height: 97.125, topPlates: 2, bottomPlates: 1, stock: 192, closed: false, wastePct: 10,
		runs: [{ id: 1, length: 144, openings: [] }]
	}
};
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'light' });
await ctx.addInitScript((s) => {
	if (!sessionStorage.getItem('seeded')) {
		sessionStorage.setItem('seeded', '1');
		localStorage.clear();
		for (const [k, v] of Object.entries(s)) localStorage.setItem('a2calc:' + k, v);
	}
	setInterval(() => {
		for (const btn of document.querySelectorAll('button')) {
			if (btn.textContent.includes('Save to project')) {
				const bar = btn.parentElement;
				bar.style.display = 'none';
				if (bar.nextElementSibling?.classList.contains('saved')) bar.nextElementSibling.style.display = 'none';
			}
		}
		for (const a of document.querySelectorAll('a[href="/projects"]')) a.style.display = 'none';
	}, 30);
}, Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, S(v)])));
const p = await ctx.newPage();
const tl = [];
let n = 0, step = 0;
const snap = async (dur, touch = null) => {
	const file = `${String(n++).padStart(4, '0')}.png`;
	await p.screenshot({ path: `${OUT}/${file}`, animations: 'disabled' });
	tl.push({ file, dur, touch, step });
};
const box = async (loc) => {
	const bb = await loc.boundingBox();
	return [bb.x + bb.width / 2, bb.y + bb.height / 2];
};
async function tap(loc, after = 0.5) {
	const at = await box(loc);
	await snap(0.25, at);
	await loc.click();
	await p.waitForTimeout(450);
	await snap(0.12, at);
	if (after) await snap(after);
}
const scrollY = () => p.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Scroll so `loc`'s top sits at viewport y `at` (CSS px), in `dur` s. */
async function scrollTo(loc, at, dur = 0.7) {
	const bb = await loc.boundingBox();
	const from = await scrollY();
	const to = Math.max(0, from + bb.y - at);
	const frames = Math.round(dur * 30);
	for (let i = 1; i <= frames; i++) {
		await p.evaluate((y) => window.scrollTo(0, y), from + (to - from) * ease(i / frames));
		await snap(1 / 30);
	}
}
async function scrollTop(dur = 0.7) {
	const from = await scrollY();
	const frames = Math.round(dur * 30);
	for (let i = 1; i <= frames; i++) {
		await p.evaluate((y) => window.scrollTo(0, y), from * (1 - ease(i / frames)));
		await snap(1 / 30);
	}
}

// 1. Open a takeoff: from the calculator, the menu, Stud wall
await p.goto(URL + '/');
await p.waitForTimeout(800);
step = 1;
await snap(0.6);
await tap(p.getByRole('button', { name: 'Menu' }).first(), 0.6);
await tap(p.locator('a[href="/takeoff/framing"]'), 1.0);

// 2. Add a wall
step = 2;
const add = p.getByRole('button', { name: /Turn a corner/ });
await scrollTo(add, 640);
await tap(add, 0.3);
await scrollTo(p.getByRole('button', { name: 'Plan', exact: true }).first(), 70);
await snap(0.9);

// 3. Type its length
step = 3;
const len = p.getByRole('button', { name: /^Length/ }).first();
await scrollTo(len, 360);
await tap(len, 0.4);
const key = (k) => (['feet', 'inch', 'fraction'].includes(k) ? p.getByRole('button', { name: k, exact: true }) : p.getByRole('button', { name: k, exact: true })).last();
for (const k of ['1', '4', 'feet']) await tap(key(k), 0.1);
await tap(p.getByRole('button', { name: 'Done' }).last(), 0.6);

// 4. Add a window
step = 4;
const addWin = p.getByRole('button', { name: /^\+?\s*Window$/ }).last();
await scrollTo(addWin, 600, 0.5);
await tap(addWin, 0.3);
const handle = p.locator('[aria-label="Window position"]').first();
const elev = p.locator('svg:has([aria-label="Window position"])').first();
await scrollTo(elev, 140);
await snap(0.8);

// 5. Slide it: the studs reframe
step = 5;
{
	const [hx, hy] = await box(handle);
	await snap(0.25, [hx, hy]);
	await p.mouse.move(hx, hy);
	await p.mouse.down();
	const path = [[0, 0], [-90, 40], [80, 55], [45, 30]];
	let x = 0;
	for (const [to, frames] of path.slice(1)) {
		const from = x;
		for (let i = 1; i <= frames; i++) {
			x = from + (to - from) * ease(i / frames);
			await p.mouse.move(hx + x, hy);
			await snap(1 / 30, [hx + x, hy]);
		}
	}
	await p.mouse.up();
	await snap(0.6);
}

// 6. See it in 3D
step = 6;
await scrollTop(0.6);
await snap(0.4);
const d3 = p.getByRole('button', { name: '3D', exact: true }).first();
await tap(d3, 0);
await p.waitForSelector('.three canvas');
await p.waitForTimeout(1200);
{
	const c = p.locator('.three canvas').first();
	const [cx, cy] = await box(c);
	await snap(0.3, [cx, cy]);
	await p.mouse.move(cx, cy);
	await p.mouse.down();
	for (let i = 1; i <= 50; i++) {
		const dx = -130 * ease(i / 50);
		await p.mouse.move(cx + dx, cy);
		await snap(1 / 30, [cx + dx, cy]);
	}
	await p.mouse.up();
	await snap(0.5);
}

// 7. The cut list
step = 7;
await scrollTo(p.getByText(/^cut list$/i).first(), 90, 1.0);
await snap(1.8);

writeFileSync(`${OUT}/timeline.json`, JSON.stringify(tl));
console.log(n, 'frames', tl.reduce((s, f) => s + f.dur, 0).toFixed(1), 's');
await b.close();
