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

export interface Solid {
	/** Center. */
	c: [number, number, number];
	/** Size along the solid's own x (its heading), y (up) and z (across). */
	s: [number, number, number];
	/** Turn about the vertical axis, radians. */
	ry: number;
	mat: string;
	shape?: 'box' | 'cyl';
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
		for (const m of rf.members) {
			if (m.role === 'header' && m.plies === 0) continue;
			const key = m.role + (on ? '*' : '');
			mats[key] ??= { color: FRAMING_COLOR[m.role], edges: true, tint: on ? SEL : 0 };
			solids.push(onWall(w, m.x, m.w, m.y, m.h, t / 2, t, key));
		}
		for (const p of rf.placed)
			if (p.o.kind === 'window') solids.push(onWall(w, p.a, p.b - p.a, bottom(p.o), p.head - bottom(p.o), t / 2, 0.5, 'glass'));
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
		for (let k = 0; k < n; k++) solids.push({ c: [x + size[0] / 2, size[1] / 2, k * (size[2] + gap) + size[2] / 2], s: size, ry: 0, mat, shape });
		x += size[0] + gap;
	});
	return { solids, mats };
}
