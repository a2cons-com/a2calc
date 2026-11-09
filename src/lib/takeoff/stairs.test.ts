import { describe, expect, it } from 'vitest';
import { stairs, type StairInput } from './stairs';

const base: StairInput = {
	code: 'irc', rise: 108, finishBottom: 0.75, finishTop: 0.75, risers: null, tread: 10.5, nosing: 1,
	treadThk: 1, riserThk: 0.75, width: 36, landings: null, landingDepth: 36, floorDepth: 12.625, stringer: '2x12'
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
});
