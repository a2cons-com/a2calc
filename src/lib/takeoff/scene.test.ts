import { describe, expect, it } from 'vitest';
import { groutVolume, wallTotals } from './grout';
import { frameWall, type Run } from './framing';
import { planWalls } from './plan';
import { blockScene, concreteScene, framingScene, wallCells } from './scene';

const door = (id: number, offset: number | null = null) => ({ id, kind: 'door' as const, width: 36, height: 84, sill: 0, offset, header: '' });

describe('block walls drawn one by one', () => {
	it('adds up length, corners, ends and openings', () => {
		const runs: Run[] = [
			{ id: 1, length: 240, openings: [door(2)] },
			{ id: 3, length: 120, openings: [] }
		];
		const t = wallTotals(runs, false, 96);
		expect(t).toEqual({ lengthIn: 360, outside: false, corners: 1, ends: 4, openingsSf: 21 });
		// A closed room has no free ends.
		const room = [...runs, { id: 4, length: 240, openings: [] }, { id: 5, length: 120, openings: [] }];
		expect(wallTotals(room, true, 96)).toMatchObject({ corners: 4, ends: 2 });
	});
	it('uses the walls in the grout volume', () => {
		const base = { width: 8 as const, lengthIn: 0, outside: true, heightIn: 96, spacingIn: 0, corners: 9, ends: 9, cellsPerCorner: 1, openingsSf: 0, wastePct: 0, pumpYd3: 0 };
		const drawn = groutVolume({ ...base, runs: [{ id: 1, length: 120, openings: [] }], closed: false });
		const typed = groutVolume({ ...base, lengthIn: 120, outside: false, corners: 0, ends: 2 });
		expect(drawn.netFt3).toBeCloseTo(typed.netFt3);
	});
	it('grouts both jambs of a door when partly grouted', () => {
		const run: Run = { id: 1, length: 192, openings: [door(2, 72)] };
		const [w] = planWalls([run], 7.625, false).walls;
		// Every 48″ (cells 0, 6, 12, 18 and the last), plus 68 and 112 by the door.
		expect(wallCells(w, 48)).toEqual([4, 52, 68, 100, 112, 148, 188]);
	});
});

describe('3D scenes', () => {
	it('draws every framing member once', () => {
		const input = { member: '2x4', spacing: 16, height: 97.125, topPlates: 2, bottomPlates: 1, stock: 192, closed: false, wastePct: 0, runs: [{ id: 1, length: 120, openings: [] }] };
		const r = frameWall(input);
		const sc = framingScene(r.runs, planWalls(input.runs, 3.5, false), 1);
		expect(sc.solids.length).toBe(r.runs[0].members.length);
	});
	it('leaves a door out of the block courses', () => {
		const run: Run = { id: 1, length: 96, openings: [] };
		const plain = blockScene(planWalls([run], 7.625, false), 96, 0, 1).solids.filter((s) => s.mat === 'block').length;
		const withDoor = blockScene(planWalls([{ ...run, openings: [door(2)] }], 7.625, false), 96, 0, 1).solids.filter((s) => s.mat === 'block');
		expect(plain).toBe(6 * 6 + 6 * 7);
		expect(withDoor.length).toBeLessThan(plain);
	});
	it('repeats a piece used several times', () => {
		const sc = concreteScene([{ id: 1, kind: 'column', a: 12, b: 12, c: 120, count: 4 }], 0);
		expect(sc.solids).toHaveLength(4);
		expect(sc.solids[0].s).toEqual([12, 120, 12]);
	});
});
