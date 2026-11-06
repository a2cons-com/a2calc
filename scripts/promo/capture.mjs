// Usage: serve the web build (npx vite preview --port 4180), then
//   node capture.mjs <out-dir> [calc,wall,block,concrete,about]
// with playwright-core whose chromium is installed (npx playwright install chromium).
// Captures A2 Calc footage as PNG frame sequences for the promo.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2];
const ONLY = process.argv[3];
const URL = 'http://localhost:4180';
const S = (o) => JSON.stringify({ v: 1, data: o });
const room = (openings) => [
	{ id: 1, length: 168, openings: openings[0] },
	{ id: 2, length: 132, openings: openings[1] },
	{ id: 3, length: 168, openings: openings[2] },
	{ id: 4, length: 132, openings: openings[3] }
];
const seed = {
	prefs: { disclaimerSeen: true, precision: 16 },
	wall: {
		member: '2x4', spacing: 16, height: 97.125, topPlates: 2, bottomPlates: 1, stock: 192, closed: true, wastePct: 10,
		runs: room([
			[{ id: 11, kind: 'window', width: 36, height: 48, sill: 36, offset: 18, header: '2x10' }],
			[{ id: 12, kind: 'door', width: 38, height: 82.5, sill: 0, offset: 30, header: '2x10' }],
			[{ id: 13, kind: 'window', width: 60, height: 48, sill: 36, offset: null, header: '2x10' }],
			[]
		])
	},
	grout: {
		width: 8, lengthIn: 600, outside: true, heightIn: 96, spacingIn: 48, corners: 0, ends: 2, cellsPerCorner: 1, openingsSf: 0,
		wastePct: 3, pumpYd3: 0, closed: true, lintel: 'poured',
		runs: [
			{ id: 21, length: 240, openings: [{ id: 31, kind: 'door', width: 40, height: 88, sill: 0, offset: 32 }, { id: 32, kind: 'window', width: 48, height: 48, sill: 40, offset: 144 }] },
			{ id: 22, length: 160, openings: [] },
			{ id: 23, length: 240, openings: [{ id: 33, kind: 'window', width: 96, height: 48, sill: 40, offset: null }] },
			{ id: 24, length: 160, openings: [] }
		]
	},
	concrete: {
		wastePct: 5, pumpYd3: 0, selected: 0,
		pieces: [
			{ id: 41, kind: 'slab', a: 240, b: 192, c: 4, count: 1 },
			{ id: 43, kind: 'column', a: 16, b: 16, c: 108, count: 4 },
			{ id: 45, kind: 'beam', a: 192, b: 12, c: 18, count: 1 },
			{ id: 44, kind: 'round', a: 12, b: 96, c: 0, count: 3 }
		]
	},
	calc: undefined
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
await ctx.addInitScript((s) => {
	if (sessionStorage.getItem('seeded')) return;
	sessionStorage.setItem('seeded', '1');
	localStorage.clear();
	for (const [k, v] of Object.entries(s)) if (v) localStorage.setItem('a2calc:' + k, v);
}, Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v && S(v)])));
const p = await ctx.newPage();
let n = 0;
const dir = (name) => { mkdirSync(`${OUT}/${name}`, { recursive: true }); n = 0; return name; };
const shot = async (name, clip) => p.screenshot({ path: `${OUT}/${name}/${String(n++).padStart(4, '0')}.png`, clip, animations: 'disabled' });
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const want = (x) => !ONLY || ONLY.split(',').includes(x);

async function rotate(name, canvas, frames, dx, dy = 0, clip) {
	const bb = await canvas.boundingBox();
	const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
	await p.mouse.move(cx, cy);
	await p.mouse.down();
	for (let i = 0; i <= frames; i++) {
		const t = ease(i / frames);
		await p.mouse.move(cx + dx * t, cy + dy * t);
		await p.waitForTimeout(16);
		await shot(name, clip);
	}
	await p.mouse.up();
}

// 1. calculator: 12' 6 1/2" + 3' 4 3/4" =
if (want('calc')) {
	await p.goto(URL + '/');
	await p.waitForTimeout(600);
	dir('calc');
	const key = async (label) => {
		const btn = label === 'FEET' || label === 'INCH' || label === 'FRACTION'
			? p.locator('button', { hasText: label }).first()
			: p.getByRole('button', { name: label, exact: true }).first();
		await btn.click();
		await p.waitForTimeout(40);
		await shot('calc');
		await shot('calc');
	};
	await shot('calc');
	for (const k of ['1', '2', 'FEET', '6', 'INCH', '1', 'FRACTION', '2', '+', '3', 'FEET', '4', 'INCH', '3', 'FRACTION', '4', '=']) await key(k);
	for (let i = 0; i < 6; i++) await shot('calc');
}

// 2. stud wall: plan, then 3D + elevation while the window is dragged
if (want('wall')) {
	await p.goto(URL + '/takeoff/framing');
	await p.waitForTimeout(800);
	dir('wall-plan');
	await shot('wall-plan');
	await p.getByRole('button', { name: '3D', exact: true }).first().click();
	await p.waitForSelector('.three canvas');
	await p.waitForTimeout(1500);
	const card = p.locator('.three').first();
	const handle = p.locator('[aria-label="Window position"]').first();
	const elev = p.locator('svg:has([aria-label="Window position"])').first();
	// a tall viewport so the 3D view and the wall elevation fit in one shot
	await p.setViewportSize({ width: 390, height: 1400 });
	await card.scrollIntoViewIfNeeded();
	await p.evaluate(() => window.scrollTo(0, 0));
	await p.waitForTimeout(400);
	const top = (await card.boundingBox()).y - 120;
	const e = await elev.boundingBox();
	await p.evaluate((y) => window.scrollTo(0, y), top);
	await p.waitForTimeout(400);
	const c2 = await card.boundingBox();
	const e2 = await elev.boundingBox();
	const clip = { x: 0, y: 0, width: 390, height: e2.y + e2.height + 24 };
	console.log('wall clip', clip, 'elev', e);
	dir('wall-3d-turn');
	await rotate('wall-3d-turn', card, 40, -110, 0, clip);
	dir('wall-drag');
	const h = await handle.boundingBox();
	const hx = h.x + h.width / 2, hy = h.y + h.height / 2;
	const touch = [];
	for (let i = 0; i < 8; i++) { touch.push(null); await shot('wall-drag', clip); }
	await p.mouse.move(hx, hy);
	await p.mouse.down();
	const path = [[0, 0], [190, 55], [15, 60], [100, 40]]; // px offsets, frames
	let x = 0;
	for (const [to, frames] of path.slice(1).map((s, i) => [s[0], s[1]])) {
		const from = x;
		for (let i = 1; i <= frames; i++) {
			x = from + (to - from) * ease(i / frames);
			await p.mouse.move(hx + x, hy);
			await p.waitForTimeout(16);
			touch.push([hx + x, hy]);
			await shot('wall-drag', clip);
		}
	}
	await p.mouse.up();
	await p.waitForTimeout(200);
	for (let i = 0; i < 10; i++) { touch.push(null); await shot('wall-drag', clip); }
	writeFileSync(`${OUT}/wall-drag/touch.json`, JSON.stringify(touch));
	dir('wall-3d-after');
	await rotate('wall-3d-after', card, 50, 160, -30, clip);
	await p.setViewportSize({ width: 390, height: 844 });
}

// 3. block wall: elevation and 3D with poured lintels
if (want('block')) {
	await p.goto(URL + '/takeoff/grout');
	await p.waitForTimeout(800);
	dir('block-top');
	await shot('block-top');
	await p.getByRole('button', { name: '3D', exact: true }).first().click();
	await p.waitForSelector('.three canvas');
	await p.waitForTimeout(1500);
	const card = p.locator('.three').first();
	await p.setViewportSize({ width: 390, height: 1400 });
	const c = await card.boundingBox();
	await p.evaluate((y) => window.scrollTo(0, y), c.y - 120);
	await p.waitForTimeout(400);
	const c2 = await card.boundingBox();
	const clip = { x: 0, y: Math.max(0, c2.y - 80), width: 390, height: 900 };
	dir('block-3d');
	await rotate('block-3d', card, 70, 130, -10, clip);
	await p.setViewportSize({ width: 390, height: 844 });
}

// 4. concrete: pieces in 3D
if (want('concrete')) {
	await p.goto(URL + '/takeoff/concrete');
	await p.waitForTimeout(800);
	await p.getByRole('button', { name: '3D', exact: true }).first().click();
	await p.waitForSelector('.three canvas');
	await p.waitForTimeout(1500);
	const card = p.locator('.three').first();
	dir('concrete-3d');
	await rotate('concrete-3d', card, 60, -120, 0);
}

// 5. about: free, no ads, no account
if (want('about')) {
	await p.goto(URL + '/about');
	await p.waitForTimeout(600);
	dir('about');
	await shot('about');
}
await b.close();
