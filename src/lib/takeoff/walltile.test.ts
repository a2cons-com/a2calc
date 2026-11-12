import { describe, expect, it } from 'vitest';
import { floorSection } from './flooring';
import { wallTile, type WallTileInput } from './walltile';

const base: WallTileInput = {
	length: 60, ceiling: 96, start: 'floor', tubHeight: 15, top: 48, left: 'corner', right: 'corner', trimTop: true, trimLen: 96,
	openings: [], pattern: 'grid', tileW: 12, tileL: 12, small: 4, offset: 0.5, turned: false, joint: 0, gap: 0,
	lineA: { kind: 'wall', side: 2, value: 0, door: 0 }, lineB: { kind: 'wall', side: 3, value: 0, door: 0 }, onLine: 'joint',
	extraPct: 0, boxSqft: 0, box2Sqft: 0, sheet: false, sheetSqft: 0, thick: 0.375, backerSqft: 0, cuts: []
};

describe('wall tile', () => {
	it('tiles a plain wall from the floor up, full rows from the bottom', () => {
		const r = wallTile(base);
		expect(r.f.layArea).toBe(60 * 48);
		expect(r.f.types[0].full).toBe(20);
		expect(r.f.types[0].cut).toBe(0);
		expect(r.trimLf).toBeCloseTo(5);
	});
	it('starts over a tub, full rows from the tub up', () => {
		const r = wallTile({ ...base, start: 'tub', tubHeight: 15, top: 75 });
		expect(r.f.layArea).toBe(60 * 60);
		expect(r.f.types[0].full).toBe(25);
	});
	it('leaves a window out, cuts around it, and trims it', () => {
		const r = wallTile({ ...base, openings: [{ id: 1, kind: 'window', x: 18, sill: 18, w: 24, h: 24, depth: 0 }], top: 60 });
		expect(r.f.layArea).toBe(60 * 60 - 24 * 24);
		// 25 tiles less 2x2 under the window, which sits on whole tiles... 18 is mid-tile:
		expect(r.f.types[0].full + r.f.types[0].cut).toBeGreaterThan(20);
		expect(r.f.covered).toBeCloseTo(60 * 60 - 24 * 24, 0);
		expect(r.trimLf).toBeCloseTo((60 + 96) / 12);
	});
	it('counts a niche back and sides by area, and the edges of an exposed end', () => {
		const r = wallTile({ ...base, right: 'edge', openings: [{ id: 1, kind: 'niche', x: 24, sill: 24, w: 12, h: 12, depth: 4 }] });
		expect(r.extraArea).toBe(144 + 2 * 24 * 4);
		expect(r.extraPcs).toBe(3);
		expect(r.trimLf).toBeCloseTo((60 + 48 + 48) / 12);
	});
	it('runs a plumb line through a window\'s middle', () => {
		const r = wallTile({ ...base, top: 60, lineB: { kind: 'door', side: 3, value: 0, door: 1 }, openings: [{ id: 1, kind: 'window', x: 20, sill: 30, w: 20, h: 20, depth: 0 }] });
		expect(r.f.lines[1].dist).toBeCloseTo(30);
	});
	it('cuts a plumb section up the wall', () => {
		const r = wallTile(base);
		const sec = floorSection(r.f, { id: 1, p: [30.5, 10], deg: 90, flip: false });
		expect(sec.len).toBeCloseTo(48);
		expect(sec.pieces.length).toBe(4);
	});
});
