// What the 3D view draws, as plain boxes and cylinders, for each takeoff:
// framing members, concrete block (with its grouted cells), and concrete
// pieces. Kept free of three.js so it can be tested and so the drawing
// code (Scene3D.svelte) stays one generic renderer.
//
// Coordinates: inches, x and z on the floor (z is the plan's y, which
// runs down the screen), y up.

import type { Opening, Role, RunFraming } from './framing';
import { COURSE_IN, groutedCells, UNIT_IN } from './grout';
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

/** Where grout goes along one wall: cell centers (inches from its start). */
export function wallCells(w: PlanWall, spacingIn: number): number[] {
	const L = w.length;
	const xs = new Set<number>();
	groutedCells(L, spacingIn).forEach((g, i) => g && xs.add(Math.min(L - COURSE_IN / 2, i * COURSE_IN + COURSE_IN / 2)));
	if (spacingIn && spacingIn > COURSE_IN)
		for (const o of w.run.openings) {
			const a = Math.max(0, Math.min(L - o.width, o.offset ?? (L - o.width) / 2));
			// The cell each side of a door or window (jambs).
			xs.add(Math.max(COURSE_IN / 2, a - COURSE_IN / 2));
			xs.add(Math.min(L - COURSE_IN / 2, a + o.width + COURSE_IN / 2));
		}
	return [...xs].sort((p, q) => p - q);
}

/** Openings on a wall as [left, right, bottom, top]. */
export function wallHoles(w: PlanWall, height: number): [number, number, number, number][] {
	const L = w.length;
	return w.run.openings.map((o) => {
		const width = Math.max(0, Math.min(o.width, L));
		const a = Math.max(0, Math.min(L - width, o.offset ?? (L - width) / 2));
		return [a, a + width, bottom(o), Math.min(height, bottom(o) + Math.max(0, o.height))];
	});
}

export function blockScene(plan: Plan, height: number, spacingIn: number, selected: number): Scene {
	const solids: Solid[] = [];
	const t = plan.depth;
	const joint = 0.375;
	const courses = Math.max(1, Math.round(height / COURSE_IN));
	const mats: Record<string, Mat> = {
		block: { color: '--cmu', opacity: 0.5 },
		'block*': { color: '--cmu', opacity: 0.5, tint: SEL },
		grout: { color: '--grout' },
		glass: { color: '--opening-edge', opacity: 0.35 }
	};
	for (const w of plan.walls) {
		const on = w.run.id === selected && plan.walls.length > 1;
		const holes = wallHoles(w, height);
		for (let k = 0; k < courses; k++) {
			const y0 = k * COURSE_IN;
			const y1 = y0 + COURSE_IN;
			const inCourse = holes.filter(([, , b, tp]) => b < y1 - 0.01 && tp > y0 + 0.01).map(([a, b2]) => [a, b2] as [number, number]);
			for (let x = k % 2 ? -UNIT_IN / 2 : 0; x < w.length; x += UNIT_IN)
				for (const [a, b] of cut(Math.max(0, x), Math.min(w.length, x + UNIT_IN), inCourse))
					if (b - a > joint * 2) solids.push(onWall(w, a, b - a - joint, y0, COURSE_IN - joint, t / 2, t, on ? 'block*' : 'block'));
		}
		const top = courses * COURSE_IN;
		for (const x of wallCells(w, spacingIn)) {
			const over = holes.filter(([a, b]) => x > a && x < b).map(([, , b, tp]) => [b, tp] as [number, number]);
			for (const [y0, y1] of cut(0, top, over)) solids.push(onWall(w, x - COURSE_IN * 0.28, COURSE_IN * 0.56, y0, y1 - y0 - joint, t / 2, t * 0.6, 'grout'));
		}
		for (const [a, b, y0, y1] of holes) if (y0 > 0) solids.push(onWall(w, a, b - a, y0, y1 - y0, t / 2, 0.5, 'glass'));
	}
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
