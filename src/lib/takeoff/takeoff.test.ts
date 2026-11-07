import { describe, expect, it } from 'vitest';
import { concreteOrder, pieceIn3, roundUpQuarter, type Piece } from './concrete';
import { groutVolume, groutedCells } from './grout';
import { frameWall, freeSpot, layout, moveRange, type WallInput } from './framing';

describe('concrete', () => {
	it('computes a slab and rounds the order up to the quarter yard', () => {
		// 20' × 20' × 4" = 133.33 cu ft = 4.938 yd
		const slab: Piece = { id: 1, kind: 'slab', a: 240, b: 240, c: 4, count: 1 };
		expect(pieceIn3(slab) / 1728).toBeCloseTo(133.333, 2);
		const r = concreteOrder([slab], 5, 0.25);
		expect(r.netYd3).toBeCloseTo(4.938, 3);
		expect(r.totalYd3).toBeCloseTo(4.938 * 1.05 + 0.25, 3);
		expect(r.orderYd3).toBe(5.5);
	});
	it('handles round columns and counts', () => {
		const col: Piece = { id: 1, kind: 'round', a: 12, b: 120, c: 0, count: 4 };
		expect(pieceIn3(col) / 1728).toBeCloseTo(Math.PI * 0.25 * 10 * 4, 4);
		expect(roundUpQuarter(2)).toBe(2);
		expect(roundUpQuarter(2.01)).toBe(2.25);
	});
});

describe('grout', () => {
	it('matches TEK 4-2A for a solid 8" wall', () => {
		// 100 sq ft solid at 8": 36.1 cu ft with the table's 3% waste.
		const r = groutVolume({ width: 8, lengthIn: 120, outside: false, heightIn: 120, spacingIn: 0, corners: 0, ends: 0, cellsPerCorner: 0, openingsSf: 0, wastePct: 3, pumpYd3: 0 });
		expect(r.totalFt3).toBeCloseTo(36.1, 2);
		expect(r.cells).toBeNull();
	});
	it('counts cells for partial grouting', () => {
		// 40' at 48" o.c. = 10 cells + 2 ends; outside lengths take off one width per corner
		const r = groutVolume({ width: 8, lengthIn: 480, outside: false, heightIn: 96, spacingIn: 48, corners: 0, ends: 2, cellsPerCorner: 0, openingsSf: 0, wastePct: 0, pumpYd3: 0 });
		expect(r.cells).toBe(12);
		const o = groutVolume({ width: 8, lengthIn: 480, outside: true, heightIn: 96, spacingIn: 48, corners: 2, ends: 0, cellsPerCorner: 2, openingsSf: 0, wastePct: 0, pumpYd3: 0 });
		expect(o.netLengthIn).toBe(464);
		expect(o.cells).toBe(10 + 4);
	});
	it('marks cells for the drawing', () => {
		expect(groutedCells(96, 32).flatMap((g, i) => (g ? [i] : []))).toEqual([0, 4, 8, 11]);
	});
});

describe('framing', () => {
	const wall = (over: Partial<WallInput> = {}): WallInput => ({
		member: '2x4', spacing: 16, height: 97.125, topPlates: 2, bottomPlates: 1, stock: 192, closed: false, wastePct: 0,
		runs: [{ id: 1, length: 120, openings: [] }],
		...over
	});
	const count = (r: ReturnType<typeof frameWall>, role: string) => r.cuts.filter((c) => c.role === role).reduce((s, c) => s + c.count, 0);

	it('lays out studs with an end stud at each end', () => {
		expect(layout(120, 16, 1.5)).toEqual([0.75, 16, 32, 48, 64, 80, 96, 112, 119.25]);
		const r = frameWall(wall());
		expect(r.studLength).toBe(92.625);
		expect(count(r, 'stud')).toBe(9);
		expect(count(r, 'top plate')).toBe(2);
		expect(count(r, 'bottom plate')).toBe(1);
		// precut studs recognized
		expect(r.buy.find((b) => b.precut)?.count).toBe(9);
	});
	it('frames a door: kings, jacks, header, cripples, plate cut out', () => {
		// 36" RO door centered in a 10' wall, 82.5" RO height
		const r = frameWall(wall({ runs: [{ id: 1, length: 120, openings: [{ id: 1, kind: 'door', width: 38, height: 82.5, sill: 0, offset: null, header: '2x10' }] }] }));
		expect(count(r, 'king')).toBe(2);
		expect(count(r, 'jack')).toBe(2);
		expect(r.cuts.find((c) => c.role === 'jack')!.length).toBe(81);
		expect(count(r, 'header')).toBe(2); // two plies of 2x10 in a 2x4 wall
		expect(r.cuts.find((c) => c.role === 'header')!.length).toBe(41);
		expect(count(r, 'bottom plate')).toBe(2);
		expect(count(r, 'cripple')).toBeGreaterThan(0);
		expect(r.warnings).toEqual([]);
	});
	it('frames a window with a sill and cripples below', () => {
		const r = frameWall(wall({ runs: [{ id: 1, length: 144, openings: [{ id: 1, kind: 'window', width: 36, height: 48, sill: 36, offset: 48, header: '2x8' }] }] }));
		expect(count(r, 'sill')).toBe(1);
		const below = r.cuts.find((c) => c.role === 'cripple' && c.length === 36 - 1.5 - 1.5);
		expect(below?.count).toBe(2);
		expect(count(r, 'bottom plate')).toBe(1);
	});
	it('adds corner backers per turn', () => {
		const runs = [1, 2, 3, 4].map((id) => ({ id, length: 120, openings: [] }));
		expect(frameWall(wall({ runs })).corners).toBe(3);
		expect(frameWall(wall({ runs, closed: true })).corners).toBe(4);
	});
	it('warns when a header hits the top plate', () => {
		const r = frameWall(wall({ runs: [{ id: 1, length: 120, openings: [{ id: 1, kind: 'door', width: 36, height: 88, sill: 0, offset: null, header: '2x12' }] }] }));
		expect(r.warnings.join()).toMatch(/top plate/);
	});
	it('places a new opening in free wall, or lengthens the wall', () => {
		const door = { id: 1, kind: 'door' as const, width: 38, height: 82.5, sill: 0, offset: 10, header: '2x10' };
		// 16' wall with a door at 10": the window goes in the free stretch past it
		const run = { id: 1, length: 192, openings: [door] };
		const spot = freeSpot(run, 36, 97.125);
		expect(spot.length).toBe(192);
		expect(spot.offset).toBeGreaterThanOrEqual(10 + 38 + 12);
		expect(spot.offset + 36).toBeLessThanOrEqual(192 - 6);
		// 6' wall already holding the door: no room, so the wall grows
		const short = { id: 2, length: 72, openings: [{ ...door, offset: 17 }] };
		const grown = freeSpot(short, 36, 97.125);
		expect(grown.offset).toBe(17 + 38 + 12);
		expect(grown.length).toBe(17 + 38 + 12 + 36 + 6);
	});
	it('limits dragging to a foot from neighbours and 6 inches from the ends', () => {
		const run = { id: 1, length: 240, openings: [
			{ id: 1, kind: 'door' as const, width: 38, height: 82.5, sill: 0, offset: 20, header: '2x10' },
			{ id: 2, kind: 'window' as const, width: 36, height: 48, sill: 36, offset: 150, header: '2x10' }
		] };
		expect(moveRange(run, 1, 97.125)).toEqual([6, 150 - 12 - 38]);
		expect(moveRange(run, 2, 97.125)).toEqual([20 + 38 + 12, 240 - 6 - 36]);
	});
});

describe('block openings', async () => {
	const { wallGrout } = await import('./grout');
	it('keep one masonry width wherever they sit, on the 8″ grid', () => {
		for (let off = 40; off < 60; off++) {
			const run = { id: 1, length: 240, openings: [{ id: 2, kind: 'window' as const, width: 36, height: 48, sill: 32, offset: off }] };
			const [a, b] = wallGrout(run, false, false, 96, 48, 1).holes[0];
			expect(b - a).toBe(40);
			expect(a % 8).toBe(0);
		}
	});
});
