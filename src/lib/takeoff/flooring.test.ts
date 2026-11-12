import { describe, expect, it } from 'vitest';
import { bestFit, cutAt, cutOffWall, flooring, floorSection, PATTERNS, type FloorInput, type FloorSide } from './flooring';

const box = (L: number, W: number): FloorSide[] => [
	{ id: 1, length: L, turn: 'right', doors: [] },
	{ id: 2, length: W, turn: 'right', doors: [] },
	{ id: 3, length: L, turn: 'right', doors: [] },
	{ id: 4, length: W, turn: 'right', doors: [] }
];
const base: FloorInput = {
	material: 'tile', rect: true, sides: box(120, 144), pattern: 'grid', tileW: 12, tileL: 12, small: 4, offset: 0.5, turned: false,
	joint: 0, gap: 0, along: 0, lineA: { kind: 'wall', side: 0, value: 0, door: 0 }, lineB: { kind: 'wall', side: 3, value: 0, door: 0 },
	onLine: 'joint', extraPct: 0, boxSqft: 0, box2Sqft: 0, sheet: false, sheetSqft: 0, thick: 0.375, rollSqft: 0, base: true, cuts: []
};

describe('flooring', () => {
	it('lays whole tiles from two walls in a room that fits them', () => {
		const r = flooring(base);
		expect(r.area).toBe(120 * 144);
		expect(r.types[0].full).toBe(120);
		expect(r.types[0].cut).toBe(0);
		expect(r.smallest).toBeNull();
	});
	it('puts the tile edge on the wall line, joint and gap included', () => {
		const r = flooring({ ...base, sides: box(120 + 0.5, 144 + 0.5), gap: 0.25, joint: 0.125, tileW: 11.875, tileL: 11.875 });
		// 10 x 12 modules of 12" exactly fill the laid area less one joint.
		expect(r.types[0].cut).toBe(0);
		expect(r.types[0].full).toBe(120);
	});
	it('centers a room on a joint and cuts the edges evenly', () => {
		const r = flooring({ ...base, sides: box(126, 126), lineA: { ...base.lineA, kind: 'center' }, lineB: { ...base.lineB, kind: 'center' } });
		// 126 = 10 full + two 3" cuts each way.
		expect(r.types[0].full).toBe(100);
		expect(r.types[0].cut).toBe(44);
		expect(r.smallest).toBeCloseTo(3, 6);
		expect(r.wallCuts.every((c) => c !== null && Math.abs(c - 3) < 1e-6)).toBe(true);
	});
	it('a piece centered on the lines instead', () => {
		const r = flooring({ ...base, sides: box(126, 126), lineA: { ...base.lineA, kind: 'center' }, lineB: { ...base.lineB, kind: 'center' }, onLine: 'center' });
		// 126 = 9 full + two 9" cuts each way.
		expect(r.types[0].full).toBe(81);
		expect(r.smallest).toBeCloseTo(9, 6);
	});
	for (const p of PATTERNS)
		for (const turned of [false, true])
			it(`covers the floor exactly, ${p.name}${turned ? ' turned' : ''}`, () => {
				const s: FloorInput = { ...base, sides: box(97, 131), pattern: p.id, tileW: 4, tileL: 12, small: 3, offset: 1 / 3, turned, lineA: { ...base.lineA, kind: 'offset', value: 7.3 }, lineB: { ...base.lineB, kind: 'offset', value: 5.1 } };
				if (p.id === 'basketweave') s.tileL = 12;
				if (p.id === 'hopscotch') s.tileW = 10;
				if (p.id === 'octagon') s.tileW = 10;
				const r = flooring(s);
				// Within crumbs too small to count (under 0.05 sq in each).
				expect(Math.abs(r.covered - r.layArea)).toBeLessThan(0.5);
				expect(r.types.reduce((t, x) => t + x.full + x.cut, 0)).toBeGreaterThan(10);
			});
	it('leaves the joints for grout', () => {
		const r = flooring({ ...base, joint: 0.25, tileW: 11.75, tileL: 11.75 });
		const share = 1 - (11.75 * 11.75) / 144;
		expect(r.covered).toBeCloseTo(r.layArea * (1 - share), 1);
		expect(r.grout!.sanded).toBe(true);
		expect(r.grout!.lbs).toBeCloseTo(r.layArea * share * 0.375 * 0.06 * 1.1, 6);
	});
	it('handles an L-shaped room', () => {
		const sides: FloorSide[] = [
			{ id: 1, length: 120, turn: 'right', doors: [] },
			{ id: 2, length: 60, turn: 'right', doors: [] },
			{ id: 3, length: 60, turn: 'left', doors: [] },
			{ id: 4, length: 60, turn: 'right', doors: [] },
			{ id: 5, length: 60, turn: 'right', doors: [] },
			{ id: 6, length: 120, turn: 'right', doors: [] }
		];
		const r = flooring({ ...base, rect: false, sides });
		expect(r.miss).toBeLessThan(1e-9);
		expect(r.area).toBe(120 * 60 + 60 * 60);
		expect(r.types[0].full).toBe(75);
		expect(r.covered).toBeCloseTo(r.area, 6);
	});
	it('orders planks in rows by area, the offcuts starting the next row', () => {
		const r = flooring({ ...base, material: 'plank', pattern: 'offset', tileW: 7, tileL: 48, extraPct: 10, boxSqft: 20 });
		const pc = 7 * 48;
		expect(r.types[0].need).toBe(Math.ceil((120 * 144) / pc));
		expect(r.types[0].order).toBe(Math.ceil(r.types[0].need * 1.1));
		expect(r.types[0].boxes).toBe(Math.ceil((r.types[0].order * pc) / 144 / 20));
	});
	it('takes off baseboard less doorways, one transition each', () => {
		const sides = box(120, 144);
		sides[1].doors.push({ id: 9, at: 20, width: 32 });
		const r = flooring({ ...base, sides });
		expect(r.baseLf).toBeCloseTo((2 * 120 + 2 * 144 - 32) / 12, 6);
		expect(r.doors).toBe(1);
	});
	it('runs a line through a doorway', () => {
		const sides = box(120, 144);
		sides[0].doors.push({ id: 9, at: 30, width: 36 });
		const r = flooring({ ...base, sides, lineB: { kind: 'door', side: 3, value: 0, door: 9 } });
		expect(r.lines[1].p[0]).toBeCloseTo(48, 6);
	});
	it('finds lines that avoid slivers', () => {
		const s: FloorInput = { ...base, sides: box(125, 133), lineA: { ...base.lineA, kind: 'offset', value: 0.5 }, lineB: { ...base.lineB, kind: 'offset', value: 0.5 } };
		expect(flooring(s).smallest).toBeLessThan(1);
		const b = bestFit(s)!;
		const r = flooring({ ...s, lineA: { ...s.lineA, value: b.a }, lineB: { ...s.lineB, value: b.b } });
		expect(r.smallest!).toBeGreaterThan(2.5);
	});

	it('cuts a section across the room, wall to wall, through each piece', () => {
		const sides = box(120, 144);
		sides[2].doors = [{ id: 9, at: 54, width: 12 }];
		const r = flooring({ ...base, sides });
		// Straight down at x = 60, looking right-to-left... seen from wall 2's side.
		const sec = floorSection(r, { id: 1, p: [60.5, 50], deg: 90, flip: false });
		expect(sec.ok).toBe(true);
		expect(sec.len).toBeCloseTo(144);
		expect(sec.pieces.length).toBe(12);
		expect(sec.pieces.every((p) => Math.abs(p.b - p.a - 12) < 1e-6)).toBe(true);
		expect(sec.ends.map((e) => e.wall).sort()).toEqual([0, 2]);
		// The doorway on wall 3 runs x 66..54: x 60.5 goes through it.
		expect(sec.ends.find((e) => e.wall === 2)!.door).toBe(true);
		expect(sec.ends.find((e) => e.wall === 0)!.door).toBe(false);
		// Left to right as seen looking +x (flip false looks to the line's right).
		expect(sec.n[0]).toBeCloseTo(-1);
	});
	it('cuts an L-shaped room by its legs, and moves a cut off a wall', () => {
		// 144 x 120 less a 72 x 60 notch at the bottom right.
		const L = [144, 60, 72, 60, 72, 120];
		const T = ['right', 'right', 'left', 'right', 'right', 'right'] as const;
		const r = flooring({ ...base, rect: false, sides: L.map((length, i) => ({ id: i, length, turn: T[i], doors: [] })) });
		const c = { id: 1, p: [36, 90] as [number, number], deg: 0, flip: false };
		expect(floorSection(r, c).len).toBeCloseTo(72);
		const off = cutOffWall(r, c)!;
		expect(off.side).toBe(4);
		expect(off.dist).toBeCloseTo(30);
		// 80 off the bottom wall is across the top, both legs: 144.
		expect(floorSection(r, { ...c, p: cutAt(r, c, off.side, 80) }).len).toBeCloseTo(144);
		expect(floorSection(r, { ...c, p: [100, 30], deg: 90 }).len).toBeCloseTo(60);
		expect(floorSection(r, { ...c, p: [200, 30] }).ok).toBe(true);
		expect(floorSection(r, { ...c, p: [200, 300] }).ok).toBe(false);
	});
});
