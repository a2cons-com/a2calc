// Where each wall run sits on the floor, for the plan and the 3D view.
//
// Walls are rectangles: a run's length along its heading, the stud depth
// across. Each wall runs through the corner at its end and the next one
// butts into it, so every plate is as long as its run (the way the
// takeoff counts them). Turns are square, right or left; the room's
// inside is on the right of the walls' direction.
//
// Plan coordinates are inches, x to the right and y down (as on screen).

import type { Run } from './framing';

export type Vec = [number, number];

export interface PlanWall {
	run: Run;
	/** Start of the wall's outside face. */
	o: Vec;
	/** Unit heading along the wall. */
	d: Vec;
	/** Unit normal into the room (right of the heading). */
	n: Vec;
	length: number;
}

export interface Plan {
	walls: PlanWall[];
	/** Wall depth, inches. */
	depth: number;
	/** Closed walls that miss their start: where the last one would have
	 *  to end, and by how much it misses (inches); null when it closes. */
	gap: { from: Vec; to: Vec; size: number } | null;
	/** Bounding box of the walls: min x, min y, max x, max y. */
	box: [number, number, number, number];
}

const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k];
/** Right of a heading (+ 0 turns -0 into 0). */
const right = (d: Vec): Vec => [-d[1] + 0, d[0] + 0];

/** The corner a wall starts at, from the wall before it. */
function next(prev: { o: Vec; d: Vec; length: number }, turn: 'left' | 'right', depth: number): { o: Vec; d: Vec } {
	const end = add(prev.o, prev.d, prev.length);
	if (turn === 'right') {
		// An outside corner: the new wall starts past the old one's depth.
		const d = right(prev.d);
		return { o: add(end, d, depth), d };
	}
	// An inside corner: the new wall's outside face is the old one's end
	// face, set back by the depth.
	const d: Vec = [-right(prev.d)[0] + 0, -right(prev.d)[1] + 0];
	return { o: add(end, prev.d, -depth), d };
}

export function planWalls(runs: Run[], depth: number, closed: boolean): Plan {
	const walls: PlanWall[] = [];
	let o: Vec = [0, 0];
	let d: Vec = [1, 0];
	runs.forEach((run, i) => {
		if (i > 0) ({ o, d } = next(walls[i - 1], run.turn ?? 'right', depth));
		walls.push({ run, o, d, n: right(d), length: Math.max(0, run.length) });
	});

	let gap: Plan['gap'] = null;
	if (closed && walls.length > 2) {
		const last = walls[walls.length - 1];
		const want = next(last, runs[0].turn ?? 'right', depth);
		const size = Math.hypot(want.o[0] - walls[0].o[0], want.o[1] - walls[0].o[1]);
		const turned = Math.abs(want.d[0] - walls[0].d[0]) + Math.abs(want.d[1] - walls[0].d[1]) > 1e-6;
		if (size > 0.25 || turned) gap = { from: add(last.o, last.d, last.length), to: walls[0].o, size };
	}

	let box: Plan['box'] = [0, 0, 0, 0];
	if (walls.length) {
		box = [Infinity, Infinity, -Infinity, -Infinity];
		for (const w of walls)
			for (const p of corners(w, depth)) {
				box[0] = Math.min(box[0], p[0]);
				box[1] = Math.min(box[1], p[1]);
				box[2] = Math.max(box[2], p[0]);
				box[3] = Math.max(box[3], p[1]);
			}
	}
	return { walls, depth, gap, box };
}

/** A point on a wall: `along` from its start, `across` into the room. */
export function at(w: PlanWall, along: number, across = 0): Vec {
	return add(add(w.o, w.d, along), w.n, across);
}

/** The wall's four corners, outside start first. */
export function corners(w: PlanWall, depth: number): Vec[] {
	return [at(w, 0), at(w, w.length), at(w, w.length, depth), at(w, 0, depth)];
}
