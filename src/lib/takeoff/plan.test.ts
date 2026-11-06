import { describe, expect, it } from 'vitest';
import { planWalls } from './plan';
import type { Run } from './framing';

const run = (id: number, length: number, turn?: 'left' | 'right'): Run => ({ id, length, openings: [], turn });

describe('floor plan', () => {
	it('lays four walls around a room, each butting the one before', () => {
		const p = planWalls([run(1, 120), run(2, 96), run(3, 120), run(4, 96)], 3.5, true);
		expect(p.walls.map((w) => w.d)).toEqual([[1, 0], [0, 1], [-1, 0], [0, -1]]);
		expect(p.walls[1].o).toEqual([120, 3.5]);
		expect(p.gap).toBeNull();
		// Outside 123.5 x 99.5: each wall runs past the next one's end.
		expect(p.box).toEqual([-3.5, 0, 120, 99.5]);
	});
	it('reports a room that does not close', () => {
		const p = planWalls([run(1, 120), run(2, 96), run(3, 110), run(4, 96)], 3.5, true);
		expect(p.gap?.size).toBeCloseTo(10);
	});
	it('turns left at an inside corner', () => {
		const p = planWalls([run(1, 120), run(2, 60, 'left')], 3.5, false);
		expect(p.walls[1].d).toEqual([0, -1]);
		expect(p.walls[1].o).toEqual([116.5, 0]);
		// The room side of the second wall faces the way the first one ran.
		expect(p.walls[1].n).toEqual([1, 0]);
	});
});
