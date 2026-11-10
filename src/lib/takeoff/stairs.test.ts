import { describe, expect, it } from 'vitest';
import { cells, stairCuts, stairs, type StairInput } from './stairs';

const base: StairInput = {
	code: 'irc', rise: 108, finishBottom: 0.75, finishTop: 0.75, risers: null, tread: 10.5, nosing: 1,
	treadThk: 1, riserThk: 0.75, width: 36, landings: null, landingDepth: 36, spots: null, floorDepth: 12.625, stringer: '2x12'
};

describe('stairs', () => {
	it('picks the fewest risers the code allows, on the finished rise', () => {
		const r = stairs(base);
		expect(r.finishedRise).toBe(108);
		expect(r.risers).toBe(14);
		expect(r.riser).toBeCloseTo(108 / 14, 6);
		expect(r.treads).toBe(13);
		expect(r.run).toBeCloseTo(13 * 10.5, 6);
		expect(r.landings).toBe(0);
		expect(r.warnings).toEqual([]);
	});
	it('cuts the stringer for the tread and the finish floors', () => {
		const r = stairs({ ...base, finishBottom: 0, finishTop: 0.75 });
		expect(r.finishedRise).toBeCloseTo(108.75, 6);
		expect(r.flights[0].firstRise).toBeCloseTo(r.riser - 1, 6);
		expect(r.topDrop).toBeCloseTo(r.riser + 1 - 0.75, 6);
	});
	it('opens the upper floor far enough for headroom', () => {
		const r = stairs(base);
		// The nosing line must be 80" under the framing (108 - 12.625).
		const R = r.riser;
		const at = ((108 - 12.625 - 80 - 0.75) / R - 1) * 10.5;
		expect(r.openingAt).toBeCloseTo(at, 4);
		expect(r.opening).toBeCloseTo(r.run - at, 4);
	});
	it('adds a landing past the tallest flight the code allows', () => {
		const r = stairs({ ...base, rise: 170 });
		expect(r.landings).toBe(1);
		expect(r.flights.length).toBe(2);
		expect(r.flights.reduce((s, f) => s + f.risers, 0)).toBe(r.risers);
		expect(r.run).toBeCloseTo(r.treads * 10.5 + 36, 6);
		expect(r.flights[1].firstRise).toBeCloseTo(r.riser, 6);
		expect(r.flights.reduce((s, f) => s + f.rise, 0)).toBeCloseTo(r.finishedRise, 6);
		expect(r.flights.reduce((s, f) => s + f.run, 0) + 36).toBeCloseTo(r.run, 6);
		expect(r.flights[0].run).toBeCloseTo(r.flights[0].treads * 10.5, 6);
	});
	it('warns on a riser over the limit', () => {
		const r = stairs({ ...base, risers: 12 });
		expect(r.warnings.some((w) => w.includes('over the'))).toBe(true);
	});
	it('holds commercial stairs to the IBC', () => {
		const r = stairs({ ...base, code: 'ibc', tread: 11 });
		expect(r.riser).toBeLessThanOrEqual(7);
		expect(r.warnings.some((w) => w.includes('width'))).toBe(true);
	});
	it('places landings by hand, each with its own depth', () => {
		const r = stairs({ ...base, rise: 170, spots: [{ at: 4, depth: 48 }, { at: 18, depth: 36 }] });
		expect(r.custom).toBe(true);
		expect(r.landings).toBe(2);
		expect(r.flights.map((f) => f.risers)).toEqual([4, 14, r.risers - 18]);
		expect(r.spots[0].height).toBeCloseTo(4 * r.riser, 6);
		expect(r.spots[0].framing).toBeCloseTo(0.75 + 4 * r.riser - 1, 6);
		expect(r.run).toBeCloseTo(r.treads * 10.5 + 48 + 36, 6);
		expect(stairCuts({ ...base, rise: 170, spots: [{ at: 4, depth: 48 }, { at: 18, depth: 36 }] }, r, String).filter((c) => c.what === 'Landing platforms').length).toBe(2);
	});
	it('keeps hand-placed landings in order and off the floors', () => {
		const r = stairs({ ...base, spots: [{ at: 40, depth: 36 }, { at: 0, depth: 36 }] });
		expect(r.spots.map((p) => p.at)).toEqual([1, r.risers - 1]);
	});
	it('turns a quarter right at a landing, the next flight against the far side', () => {
		const r = stairs({ ...base, rise: 120, spots: [{ at: 8, depth: 36, turn: 'right' }] });
		const [a, b] = r.flights;
		const p = r.spots[0];
		expect(r.turns).toBe(true);
		expect(a.d).toEqual([1, 0]);
		expect(b.d).toEqual([0, 1]);
		// Landing 36 x 36 off the end of flight 1; flight 2 leaves its far
		// side heading down the plan, its left edge on the far wall.
		expect(p.size).toEqual([36, 36]);
		expect(b.o[0]).toBeCloseTo(a.run + 36, 6);
		expect(b.o[1]).toBeCloseTo(36, 6);
		expect(r.bounds.c1).toBeCloseTo(36 + b.run, 6);
	});
	it('turns a half turn with a gap, and the flight above may be wider', () => {
		const input: StairInput = { ...base, rise: 120, spots: [{ at: 8, depth: 40, turn: 'u-left', gap: 4, width: 42 }] };
		const r = stairs(input);
		const [a, b] = r.flights;
		expect(b.d).toEqual([-1, 0]);
		expect(b.width).toBe(42);
		expect(r.spots[0].size).toEqual([40, 36 + 4 + 42]);
		expect(b.o[0]).toBeCloseTo(a.run, 6);
		expect(b.o[1]).toBeCloseTo(-4, 6);
		expect(stairCuts(input, r, String).filter((c) => c.what === 'Treads').length).toBe(2);
	});
	it('sizes an L landing from the widths plus the spaces past and before the risers', () => {
		const r = stairs({ ...base, rise: 120, spots: [{ at: 8, depth: 30, turn: 'left', width: 40 }] });
		expect(r.spots[0].past).toBe(0);
		expect(r.spots[0].next).toBe(0);
		expect(r.spots[0].size).toEqual([40, 36]);
		const s = stairs({ ...base, rise: 120, spots: [{ at: 8, depth: 30, turn: 'left', width: 40, past: 2, next: 3 }] });
		expect(s.spots[0].size).toEqual([42, 39]);
		expect(s.flights[1].o[0]).toBeCloseTo(s.flights[0].run + 2, 6);
		expect(s.flights[1].o[1]).toBeCloseTo(-3, 6);
		// A narrow stair gets the code's 36" anyway.
		const n = stairs({ ...base, rise: 120, width: 30, spots: [{ at: 8, depth: 30, turn: 'right' }] });
		expect(n.spots[0].past).toBe(6);
		expect(n.spots[0].size).toEqual([36, 36]);
	});
	it('staggers the risers at a U landing', () => {
		const r = stairs({ ...base, rise: 120, spots: [{ at: 8, depth: 36, turn: 'u-right', next: 4 }] });
		expect(r.flights[1].o[0]).toBeCloseTo(r.flights[0].run - 4, 6);
		expect(r.spots[0].size).toEqual([40, 72]);
	});
	it('warns on a landing too shallow', () => {
		const s = stairs({ ...base, rise: 120, spots: [{ at: 8, depth: 30 }] });
		expect(s.warnings.some((w) => w.startsWith('Landing 1'))).toBe(true);
	});
	it('cuts a notch out of a landing corner', () => {
		const r = stairs({ ...base, rise: 120, spots: [{ at: 8, depth: 36, turn: 'right', notch: { corner: 'far-left', along: 6, across: 4.5 } }] });
		expect(r.spots[0].outline.length).toBe(1);
		expect(r.spots[0].outline[0].length).toBe(6);
	});
	it('outlines rectangles less holes', () => {
		const { boxes, loops } = cells([{ a0: 0, a1: 10, c0: 0, c1: 10 }], [{ a0: 8, a1: 10, c0: 0, c1: 2 }]);
		expect(loops.length).toBe(1);
		expect(loops[0].length).toBe(6);
		expect(boxes.reduce((s, b) => s + (b.a1 - b.a0) * (b.c1 - b.c0), 0)).toBe(96);
	});
	it('opens the floor the same in plan as along the run, for a straight stair', () => {
		const r = stairs(base);
		expect(r.openingPlan.size[0]).toBeCloseTo(r.opening, 4);
		expect(r.openingPlan.size[1]).toBe(36);
	});
});
