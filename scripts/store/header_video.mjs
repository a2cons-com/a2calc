// Frames for the App Store header and search-results videos (iOS 27
// creative assets): real app footage, composed by header_video.py.
//
//   npx vite preview --port 4190                     # the web build
//   npm i --no-save playwright@1.64.0                # with its own chromium
//   node scripts/store/header_video.mjs <frames-dir>
//
// Writes <dir>/wall/{3d,elev}/NNNN.png (the stud wall turning while a
// window slides along it and back; the 3D view reframes too),
// <dir>/block/NNNN.png and <dir>/concrete/NNNN.png (3D, turning).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2];
const URL = process.env.URL ?? 'http://localhost:4190';
const WALL_FRAMES = 240; // 8 s at 30 fps
const TURN_FRAMES = 240;
const S = (o) => JSON.stringify({ v: 1, data: o });
const seed = {
	prefs: { disclaimerSeen: true, precision: 16, fmt: { 1: 'ftin', 2: 'sqft', 3: 'cuyd' }, haptics: true },
	wall: {
		member: '2x4', spacing: 16, height: 97.125, topPlates: 2, bottomPlates: 1, stock: 192, closed: true, wastePct: 10,
		runs: [
			{ id: 1, length: 192, openings: [{ id: 11, kind: 'window', width: 48, height: 48, sill: 36, offset: 20, header: '2x10' }] },
			{ id: 2, length: 144, openings: [{ id: 12, kind: 'door', width: 38, height: 82.5, sill: 0, offset: 52, header: '2x10' }] },
			{ id: 3, length: 192, openings: [{ id: 13, kind: 'window', width: 72, height: 48, sill: 36, offset: 60, header: '2x12' }] },
			{ id: 4, length: 144, openings: [] }
		]
	},
	grout: {
		width: 8, lengthIn: 480, outside: true, heightIn: 120, spacingIn: 32, corners: 0, ends: 2, cellsPerCorner: 1, openingsSf: 0,
		wastePct: 3, pumpYd3: 0, closed: true, lintel: 'grout',
		runs: [
			{ id: 5, length: 192, openings: [{ id: 51, kind: 'door', width: 40, height: 88, sill: 0, offset: 24 }, { id: 52, kind: 'window', width: 48, height: 48, sill: 40, offset: 112 }] },
			{ id: 6, length: 160, openings: [{ id: 61, kind: 'window', width: 72, height: 48, sill: 40, offset: 48 }] },
			{ id: 7, length: 192, openings: [] },
			{ id: 8, length: 160, openings: [] }
		]
	},
	concrete: {
		wastePct: 5, pumpYd3: 0, selected: 0,
		pieces: [
			{ id: 1, kind: 'slab', a: 240, b: 192, c: 6, count: 1 },
			{ id: 4, kind: 'round', a: 18, b: 96, c: 0, count: 4 },
			{ id: 2, kind: 'column', a: 16, b: 16, c: 96, count: 2 },
			{ id: 3, kind: 'footing', a: 96, b: 24, c: 12, count: 2 }
		]
	}
};

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 560, height: 2400 }, deviceScaleFactor: 3, colorScheme: 'light' });
await ctx.addInitScript((s) => {
	if (sessionStorage.getItem('seeded')) return;
	sessionStorage.setItem('seeded', '1');
	localStorage.clear();
	for (const [k, v] of Object.entries(s)) localStorage.setItem('a2calc:' + k, v);
}, Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, S(v)])));
const p = await ctx.newPage();
await p.addInitScript(() => {
	const st = document.createElement('style');
	st.textContent = '.page-head{background:var(--bg)!important}';
	document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
});
const frame = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const smooth = (t) => (1 - Math.cos(Math.PI * t)) / 2;
const pad = (n) => String(n).padStart(4, '0');

async function open3d(route) {
	await p.goto(URL + route);
	await p.waitForTimeout(800);
	await p.getByRole('button', { name: '3D', exact: true }).first().click();
	await p.waitForSelector('.three canvas');
	await p.waitForTimeout(2000);
	return p.locator('.three canvas').first();
}

// Drag on the 3D view by (dx, dy) CSS px, as one short gesture.
async function turn(canvas, dx, dy = 0) {
	const bb = await canvas.boundingBox();
	const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
	await p.mouse.move(x, y);
	await p.mouse.down();
	await p.mouse.move(x + dx, y + dy, { steps: 2 });
	await p.mouse.up();
}

// 1. Stud wall: the window slides along wall 1 and back while the 3D view turns.
{
	const canvas = await open3d('/takeoff/framing');
	const handle = p.locator('[aria-label="Window position"]').first();
	const elev = p.locator('svg:has([aria-label="Window position"])').first();
	mkdirSync(`${OUT}/wall/3d`, { recursive: true });
	mkdirSync(`${OUT}/wall/elev`, { recursive: true });
	await turn(canvas, 40, 0); // a starting angle that shows wall 1's window
	const SLIDE = 150; // CSS px along the elevation
	let at = 0, turned = 0;
	for (let i = 0; i < WALL_FRAMES; i++) {
		const t = i / WALL_FRAMES;
		// out and back with a pause at each end: 0..0.1 hold, 0.1..0.45 out, 0.45..0.55 hold, 0.55..0.9 back
		const s = t < 0.1 ? 0 : t < 0.45 ? smooth((t - 0.1) / 0.35) : t < 0.55 ? 1 : t < 0.9 ? 1 - smooth((t - 0.55) / 0.35) : 0;
		const want = SLIDE * s;
		if (Math.abs(want - at) > 0.01) {
			const h = await handle.boundingBox();
			const hx = h.x + h.width / 2, hy = h.y + h.height / 2;
			await p.mouse.move(hx, hy);
			await p.mouse.down();
			await p.mouse.move(hx + (want - at), hy, { steps: 2 });
			await p.mouse.up();
			at = want;
		}
		// a slow, steady turn: about 0.35 px per frame (fractional pointer moves)
		const target = 0.35 * (i + 1);
		const step = target - turned;
		if (step > 0) { await turn(canvas, -step); turned = target; }
		await frame();
		await canvas.screenshot({ path: `${OUT}/wall/3d/${pad(i)}.png` });
		await elev.screenshot({ path: `${OUT}/wall/elev/${pad(i)}.png` });
		if (i % 40 === 0) console.log('wall', i);
	}
}

// 2. Block wall and concrete, turning.
for (const [name, route, speed] of [['block', '/takeoff/grout', 0.45], ['concrete', '/takeoff/concrete', 0.45]]) {
	const canvas = await open3d(route);
	mkdirSync(`${OUT}/${name}`, { recursive: true });
	const bb = await canvas.boundingBox();
	const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
	await p.mouse.move(x, y);
	await p.mouse.down();
	for (let i = 0; i < TURN_FRAMES; i++) {
		await p.mouse.move(x - speed * (i + 1), y);
		await frame();
		await canvas.screenshot({ path: `${OUT}/${name}/${pad(i)}.png` });
	}
	await p.mouse.up();
	console.log(name, 'done');
}
await b.close();
