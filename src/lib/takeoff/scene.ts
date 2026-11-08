// What the 3D view draws, as plain boxes and cylinders, for each takeoff:
// framing members, concrete block (with its grouted cells), and concrete
// pieces. Kept free of three.js so it can be tested and so the drawing
// code (Scene3D.svelte) stays one generic renderer.
//
// Coordinates: inches, x and z on the floor (z is the plan's y, which
// runs down the screen), y up.

import type { Opening, Role, RunFraming } from './framing';
import { COURSE_IN, UNIT_IN, wallsGrout, type LintelKind } from './grout';
import type { Piece } from './concrete';
import { at, type Plan, type PlanWall } from './plan';
import { STRINGER_DEPTH, type StairInput, type StairResult } from './stairs';

export interface Solid {
	/** Center. */
	c: [number, number, number];
	/** Size along the solid's own x (its heading), y (up) and z (across). */
	s: [number, number, number];
	/** Turn about the vertical axis, radians. */
	ry: number;
	/** Tilt about the solid's own z (across), radians: a sloped stringer. */
	rz?: number;
	mat: string;
	shape?: 'box' | 'cyl';
	/** What a tap on it selects: a wall's run id, a concrete piece's index. */
	pick?: number;
}

export interface Mat {
	/** A theme color variable, e.g. '--wood'. */
	color: string;
	opacity?: number;
	/** Outline each solid (off for thousands of blocks). */
	edges?: boolean;
	/** Outline color variable (default '--wood-edge'). */
	edge?: string;
	/** Mix this much of the accent color in (0..1): the selected item. */
	tint?: number;
}

export interface Scene {
	solids: Solid[];
	mats: Record<string, Mat>;
}

const SEL = 0.3;

/** A box on a plan wall: `along` and `len` along it, `y0`/`h` up, centered
 *  `across` into the room with depth `depth`. */
function onWall(w: PlanWall, along: number, len: number, y0: number, h: number, across: number, depth: number, mat: string): Solid {
	const p = at(w, along + len / 2, across);
	return { c: [p[0], y0 + h / 2, p[1]], s: [len, h, depth], ry: Math.atan2(-w.d[1], w.d[0]), mat };
}

/** Bottom of an opening: 0 for a door, its sill for a window. */
const bottom = (o: Opening) => (o.kind === 'door' ? 0 : Math.max(0, o.sill));

const FRAMING_COLOR: Record<Role, string> = {
	stud: '--wood',
	corner: '--wood',
	king: '--wood-king',
	jack: '--wood-king',
	cripple: '--wood',
	header: '--wood-header',
	sill: '--wood-header',
	'top plate': '--plate',
	'bottom plate': '--plate'
};

export function framingScene(runs: RunFraming[], plan: Plan, selected: number): Scene {
	const solids: Solid[] = [];
	const mats: Record<string, Mat> = { glass: { color: '--opening-edge', opacity: 0.35 } };
	const t = plan.depth;
	plan.walls.forEach((w, i) => {
		const rf = runs[i];
		if (!rf) return;
		const on = w.run.id === selected && plan.walls.length > 1;
		const from = solids.length;
		for (const m of rf.members) {
			if (m.role === 'header' && m.plies === 0) continue;
			const key = m.role + (on ? '*' : '');
			mats[key] ??= { color: FRAMING_COLOR[m.role], edges: true, tint: on ? SEL : 0 };
			solids.push(onWall(w, m.x, m.w, m.y, m.h, t / 2, t, key));
		}
		for (const p of rf.placed)
			if (p.o.kind === 'window') solids.push(onWall(w, p.a, p.b - p.a, bottom(p.o), p.head - bottom(p.o), t / 2, 0.5, 'glass'));
		for (let j = from; j < solids.length; j++) solids[j].pick = w.run.id;
	});
	return { solids, mats };
}

/** Pieces of [a, b] left after cutting out the given ranges. */
function cut(a: number, b: number, holes: [number, number][]): [number, number][] {
	let out: [number, number][] = [[a, b]];
	for (const [h0, h1] of holes)
		out = out.flatMap(([x0, x1]) => (h1 <= x0 || h0 >= x1 ? [[x0, x1]] : ([[x0, Math.min(x1, h0)], [Math.max(x0, h1), x1]] as [number, number][]).filter(([p, q]) => q - p > 0.01)));
	return out;
}

export function blockScene(plan: Plan, height: number, spacingIn: number, cellsPerCorner: number, closed: boolean, lintel: LintelKind, selected: number): Scene {
	const solids: Solid[] = [];
	const t = plan.depth;
	const joint = 0.375;
	const courses = Math.max(1, Math.round(height / COURSE_IN));
	const mats: Record<string, Mat> = {
		block: { color: '--cmu', opacity: 0.5 },
		'block*': { color: '--cmu', opacity: 0.5, tint: SEL },
		grout: { color: '--grout' },
		lintel: { color: '--grout', tint: 0.15 },
		poured: { color: '--concrete', edges: true, edge: '--concrete-side' },
		glass: { color: '--opening-edge', opacity: 0.35 }
	};
	const poured = lintel === 'poured';
	const grout = wallsGrout(plan.walls.map((w) => w.run), closed, height, spacingIn, cellsPerCorner, lintel);
	plan.walls.forEach((w, wi) => {
		const on = w.run.id === selected && plan.walls.length > 1;
		const from = solids.length;
		const g = grout[wi];
		// Block is left out of openings, and of poured lintels.
		const holes = poured ? [...g.holes, ...g.lintels.map((l) => [l.a, l.b, l.y0, l.y1] as [number, number, number, number])] : g.holes;
		for (let k = 0; k < courses; k++) {
			const y0 = k * COURSE_IN;
			const y1 = y0 + COURSE_IN;
			const inCourse = holes.filter(([, , b, tp]) => b < y1 - 0.01 && tp > y0 + 0.01).map(([a, b2]) => [a, b2] as [number, number]);
			for (let x = k % 2 ? -UNIT_IN / 2 : 0; x < w.length; x += UNIT_IN)
				for (const [a, b] of cut(Math.max(0, x), Math.min(w.length, x + UNIT_IN), inCourse))
					if (b - a > joint * 2) solids.push(onWall(w, a, b - a - joint, y0, COURSE_IN - joint, t / 2, t, on ? 'block*' : 'block'));
		}
		for (const c of g.columns) solids.push(onWall(w, c.x - COURSE_IN * 0.28, COURSE_IN * 0.56, c.y0, c.y1 - c.y0 - joint, t / 2, t * 0.6, 'grout'));
		for (const l of g.lintels)
			solids.push(poured ? onWall(w, l.a, l.b - l.a, l.y0, l.y1 - l.y0, t / 2, t, 'poured') : onWall(w, l.a, l.b - l.a, l.y0, l.y1 - l.y0 - joint, t / 2, t * 0.75, 'lintel'));
		for (const [a, b, y0, y1] of g.holes) if (y0 > 0) solids.push(onWall(w, a, b - a, y0, y1 - y0, t / 2, 0.5, 'glass'));
		for (let j = from; j < solids.length; j++) solids[j].pick = w.run.id;
	});
	return { solids, mats };
}

/** Most copies of one piece drawn; the rest are only counted. */
export const MAX_COPIES = 12;

/** Concrete pieces side by side (they have no positions of their own), a
 *  piece used several times repeated behind itself. */
export function concreteScene(pieces: Piece[], selected: number): Scene {
	const solids: Solid[] = [];
	const mats: Record<string, Mat> = {
		concrete: { color: '--concrete', edges: true, edge: '--concrete-side' },
		'concrete*': { color: '--concrete', edges: true, edge: '--concrete-side', tint: SEL }
	};
	const gap = 24;
	let x = 0;
	pieces.forEach((p, i) => {
		const mat = i === selected && pieces.length > 1 ? 'concrete*' : 'concrete';
		const pos = (v: number) => Math.max(1, v || 0);
		// Size along x (length), y (up), z (width).
		let size: [number, number, number];
		let shape: Solid['shape'] = 'box';
		switch (p.kind) {
			case 'wall':
				size = [pos(p.a), pos(p.b), pos(p.c)];
				break;
			case 'round':
				size = [pos(p.a), pos(p.b), pos(p.a)];
				shape = 'cyl';
				break;
			case 'column':
				size = [pos(p.a), pos(p.c), pos(p.b)];
				break;
			default:
				size = [pos(p.a), pos(p.c), pos(p.b)];
		}
		const n = Math.max(1, Math.min(MAX_COPIES, Math.floor(p.count || 1)));
		for (let k = 0; k < n; k++) solids.push({ c: [x + size[0] / 2, size[1] / 2, k * (size[2] + gap) + size[2] / 2], s: size, ry: 0, mat, shape, pick: i });
		x += size[0] + gap;
	});
	return { solids, mats };
}

/** A stair along x (width along z): floors, the upper floor seen through,
 *  stringers, treads and risers, landings on posts. */
export function stairScene(input: StairInput, r: StairResult): Scene {
	const solids: Solid[] = [];
	const mats: Record<string, Mat> = {
		slab: { color: '--concrete', edges: true, edge: '--concrete-side' },
		floor: { color: '--concrete-top', opacity: 0.35 },
		stringer: { color: '--wood', edges: true },
		tread: { color: '--wood-header', edges: true },
		riser: { color: '--plate', edges: true },
		frame: { color: '--wood-king', edges: true }
	};
	const W = Math.max(12, input.width);
	const T = Math.max(1, input.tread);
	const tt = Math.max(0, input.treadThk);
	const rt = Math.max(0, input.riserThk);
	const nose = Math.max(0, input.nosing);
	const fd = Math.max(1, input.floorDepth);
	const rise = Math.max(1, input.rise);
	const D = STRINGER_DEPTH[input.stringer];
	const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: string): Solid => ({
		c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
		s: [Math.max(0.1, x1 - x0), Math.max(0.1, y1 - y0), Math.max(0.1, z1 - z0)],
		ry: 0,
		mat
	});
	const before = 36;
	const after = Math.max(36, input.landingDepth);
	solids.push(box(-before, r.run + after, -4, 0, -12, W + 12, 'slab'));
	if (r.openingAt > -before) solids.push(box(-before, r.openingAt, rise - fd, rise, -12, W + 12, 'floor'));
	solids.push(box(r.run, r.run + after, rise - fd, rise, -12, W + 12, 'floor'));

	// Stringers, spread across the width.
	const zs = Array.from({ length: r.stringers }, (_, i) => 0.75 + ((W - 1.5) * i) / Math.max(1, r.stringers - 1));
	const R = r.riser;
	const th = Math.atan2(R, T);
	const drop = Math.max(0.5, r.throat);
	for (const f of r.flights) {
		if (f.risers < 2) continue;
		const c1 = f.seat + f.firstRise;
		const inner = (x: number) => c1 + (x - (f.x0 + T)) * (R / T);
		const xa = f.x0;
		const xb = f.x1;
		const len = (xb - xa) / Math.cos(th);
		const xm = (xa + xb) / 2;
		const ym = inner(xm);
		for (const z of zs) {
			solids.push({ c: [xm + (Math.sin(th) * drop) / 2, ym - (Math.cos(th) * drop) / 2, z], s: [len, drop, 1.5], ry: 0, rz: th, mat: 'stringer' });
			// The teeth under each tread.
			for (let k = 1; k < f.risers; k++) {
				const x0 = f.x0 + (k - 1) * T;
				const c = c1 + (k - 1) * R;
				solids.push(box(x0, x0 + T, c - R, c, z - 0.75, z + 0.75, 'stringer'));
			}
		}
	}
	for (const s of r.steps) {
		if (s.kind === 'tread') solids.push(box(s.x0 - rt - nose, s.x1, s.y - tt, s.y, 0, W, 'tread'));
		if (s.kind === 'landing') {
			solids.push(box(s.x0 - rt - nose, s.x1, s.y - tt, s.y, 0, W, 'tread'));
			solids.push(box(s.x0, s.x1, s.y - tt - D, s.y - tt, 0, W, 'frame'));
			for (const px of [s.x0 + 1.75, s.x1 - 1.75]) for (const pz of [1.75, W - 1.75]) solids.push(box(px - 1.75, px + 1.75, 0, s.y - tt - D, pz - 1.75, pz + 1.75, 'frame'));
		}
		const top = s.y - (s.kind === 'top' ? Math.max(0, input.finishTop) : tt);
		solids.push(box(s.x0 - rt, s.x0, top - r.riserBoard, top, 0, W, 'riser'));
	}
	return { solids, mats };
}
