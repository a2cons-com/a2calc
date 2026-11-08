// Usage: serve the web build (npx vite preview --port 4180), then
//   [DSF=3] [URL=http://localhost:4180] node capture-calc.mjs <out-dir>
// The calculator full screen, a few everyday sums typed key by key: two
// frames per key press, and touch.json with where each key was tapped (CSS
// px of 390x844) or null for a pause, which a video can stretch.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = `${process.argv[2]}/calc-full`;
const URL = process.env.URL ?? 'http://localhost:4180';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DSF ?? 2), colorScheme: 'light' });
await ctx.addInitScript(() => {
	if (sessionStorage.getItem('seeded')) return;
	sessionStorage.setItem('seeded', '1');
	localStorage.clear();
	localStorage.setItem('a2calc:prefs', JSON.stringify({ v: 1, data: { disclaimerSeen: true, precision: 16 } }));
});
const p = await ctx.newPage();
await p.goto(URL + '/');
await p.waitForTimeout(800);
let n = 0;
const touch = [];
const shot = async (t = null) => {
	touch.push(t);
	await p.screenshot({ path: `${OUT}/${String(n++).padStart(4, '0')}.png`, animations: 'disabled' });
};
const key = async (label) => {
	const btn = ['FEET', 'INCH', 'FRACTION'].includes(label)
		? p.locator('button', { hasText: label }).first()
		: p.getByRole('button', { name: label, exact: true }).first();
	const bb = await btn.boundingBox();
	const at = [bb.x + bb.width / 2, bb.y + bb.height / 2];
	await btn.click();
	await p.waitForTimeout(40);
	await shot(at);
	await shot(at);
};
const SUMS = [
	['1', '2', 'FEET', '6', 'INCH', '1', 'FRACTION', '2', '+', '3', 'FEET', '4', 'INCH', '3', 'FRACTION', '4', '='],
	['×', '2', '='],
	['AC', '1', '5', 'FEET', '×', '1', '2', 'FEET', '6', 'INCH', '='],
	['AC', '8', 'FEET', '÷', '3', '='],
	['AC', '5', 'INCH', '1', 'FRACTION', '2', '+', '3', 'FRACTION', '4', '=']
];
for (let i = 0; i < 3; i++) await shot();
for (const sum of SUMS) {
	for (const k of sum) await key(k);
	for (let i = 0; i < 4; i++) await shot();
}
await key('AC');
for (let i = 0; i < 3; i++) await shot();
writeFileSync(`${OUT}/touch.json`, JSON.stringify(touch));
await b.close();
