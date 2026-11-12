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
import { BASE_H, BASE_T, floorStack, polyRects, WALL_T, type FloorInput, type FloorResult } from './flooring';
import { cells, rectToPlan, toPlan, type Rect, type StairInput, type StairResult, type V2 } from './stairs';

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
	/** A prism: `profile` (in the solid's own x-y plane, about its center)
	 *  pushed out along its own z by s[2]. */
	shape?: 'box' | 'cyl' | 'prism';
	profile?: [number, number][];
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

/** A flat outline on plan (x, plan y) pushed up from y0 by h: a tile, a
 *  layer of the floor. Slabs of one material draw as one mesh. */
export interface Slab {
	poly: [number, number][];
	y0: number;
	h: number;
	mat: string;
}

export interface Scene {
	solids: Solid[];
	mats: Record<string, Mat>;
	slabs?: Slab[];
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

/** A stringer's outline, along its flight (from the first riser) and up:
 *  plumb and level cuts at the seat, the notches, a plumb cut at the top
 *  (held under `support`), the bottom edge parallel to the notches. */
export function stringerOutline(f: { risers: number; seat: number; firstRise: number }, R: number, T: number, drop: number, support: number): [number, number][] {
	const sl = R / T;
	const c1 = f.seat + f.firstRise;
	const bottom = (a: number) => c1 + (a - T) * sl - drop;
	const pts: [number, number][] = [
		[0, f.seat],
		[0, c1]
	];
	let c = c1;
	let a = 0;
	for (let k = 1; k < f.risers; k++) {
		a += T;
		pts.push([a, c]);
		c += R;
		pts.push([a, c]);
	}
	pts[pts.length - 1][1] = Math.min(c, support);
	pts.push([a, Math.min(bottom(a), support - 1)]);
	pts.push([Math.max(0, T + (f.seat + drop - c1) / sl), f.seat]);
	return pts;
}

/** A stair, turns and all: floors (the upper one seen through, with its
 *  opening), stringers, treads and risers, landings (their surface only). */
export function stairScene(input: StairInput, r: StairResult): Scene {
	const solids: Solid[] = [];
	const mats: Record<string, Mat> = {
		slab: { color: '--concrete', edges: true, edge: '--concrete-side' },
		floor: { color: '--concrete-top', opacity: 0.35 },
		stringer: { color: '--wood', edges: true },
		tread: { color: '--wood-header', edges: true },
		riser: { color: '--plate', edges: true }
	};
	const T = Math.max(1, input.tread);
	const tt = Math.max(0, input.treadThk);
	const rt = Math.max(0, input.riserThk);
	const nose = Math.max(0, input.nosing);
	const fd = Math.max(1, input.floorDepth);
	const rise = Math.max(1, input.rise);
	/** A box in a frame: along a0..a1 from o heading d, across c0..c1 to
	 *  the right, y0..y1 up; tilted by rz about its across axis. */
	const box = (o: V2, d: V2, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, mat: string, rz = 0): Solid => {
		const p = toPlan(o, d, (a0 + a1) / 2, (c0 + c1) / 2);
		return { c: [p[0], (y0 + y1) / 2, p[1]], s: [Math.max(0.1, a1 - a0), Math.max(0.1, y1 - y0), Math.max(0.1, c1 - c0)], ry: Math.atan2(-d[1], d[0]), rz: rz || undefined, mat };
	};
	const flat = (q: Rect, y0: number, y1: number, mat: string) => box([0, 0], [1, 0], q.a0, q.a1, y0, y1, q.c0, q.c1, mat);

	// Floors: the slab under it all, the upper floor around the opening.
	const f0 = r.flights[0];
	const pad = (q: Rect, m: number): Rect => ({ a0: q.a0 - m, a1: q.a1 + m, c0: q.c0 - m, c1: q.c1 + m });
	const all = [r.bounds, r.topFloor, rectToPlan(f0.o, f0.d, { a0: -36, a1: 0, c0: 0, c1: f0.width })];
	const out: Rect = { a0: Math.min(...all.map((q) => q.a0)), a1: Math.max(...all.map((q) => q.a1)), c0: Math.min(...all.map((q) => q.c0)), c1: Math.max(...all.map((q) => q.c1)) };
	solids.push(flat(pad(out, 12), -4, 0, 'slab'));
	for (const q of cells([pad(out, 12)], r.openingPlan.boxes).boxes) solids.push(flat(q, rise - fd, rise, 'floor'));

	const R = r.riser;
	const th = Math.atan2(R, T);
	const drop = Math.max(0.5, r.throat);
	for (const f of r.flights) {
		if (f.risers < 2) continue;
		// Stringers, spread across the flight: the cut outline (as in the
		// section) pushed out 1½", along from the flight's first riser.
		const zs = Array.from({ length: f.stringers }, (_, i) => 0.75 + ((f.width - 1.5) * i) / Math.max(1, f.stringers - 1));
		const profile = stringerOutline(f, R, T, drop / Math.cos(th), f === r.flights[r.flights.length - 1] ? rise : f.y1 - tt);
		const top = Math.max(...profile.map((p) => p[1]));
		for (const z of zs) {
			const p = toPlan(f.o, f.d, 0, z);
			solids.push({ c: [p[0], 0, p[1]], s: [0.1, top * 2, 1.5], ry: Math.atan2(-f.d[1], f.d[0]), mat: 'stringer', shape: 'prism', profile });
		}
	}
	for (const s of r.steps) {
		const f = r.flights[s.flight];
		const a0 = s.x0 - f.x0;
		if (s.kind === 'tread') solids.push(box(f.o, f.d, a0 - rt - nose, s.x1 - f.x0, s.y - tt, s.y, 0, f.width, 'tread'));
		if (s.kind === 'landing') {
			// Just the landing surface: how it's held up is the framer's call.
			const p = r.spots.find((q) => Math.abs(q.x0 - s.x0) < 1e-6);
			if (p) {
				solids.push(box(f.o, f.d, a0 - rt - nose, a0, s.y - tt, s.y, 0, f.width, 'tread'));
				const shape = cells(p.rects.map((q) => rectToPlan(p.o, p.d, q)), p.holes.map((q) => rectToPlan(p.o, p.d, q)));
				for (const q of shape.boxes) solids.push(flat(q, s.y - tt, s.y, 'tread'));
			}
		}
		const top = s.y - (s.kind === 'top' ? Math.max(0, input.finishTop) : tt);
		solids.push(box(f.o, f.d, a0 - rt, a0, top - r.riserBoard, top, 0, f.width, 'riser'));
	}
	return { solids, mats };
}

/** A floor: the subfloor and underlayment to the walls, the grout bed,
 *  every piece as cut, low walls (doorways open) and the base. */
export function floorScene(s: FloorInput, r: FloorResult): Scene {
	const solids: Solid[] = [];
	const slabs: Slab[] = [];
	const plank = s.material === 'plank';
	const mats: Record<string, Mat> = {
		sub: { color: '--plate' },
		under: { color: '--concrete-side' },
		bed: { color: '--grout' },
		a: { color: plank ? '--wood' : '--concrete-top', edges: !plank && r.pieces.length < 4000, edge: '--grout' },
		b: { color: plank ? '--wood-king' : '--cmu', edges: !plank && r.pieces.length < 4000, edge: '--grout' },
		ac: { color: plank ? '--wood' : '--concrete-top', opacity: 0.8 },
		bc: { color: plank ? '--wood-king' : '--cmu', opacity: 0.8 },
		thin: { color: '--danger' },
		wall: { color: '--surface', edges: true, edge: '--border' },
		base: { color: '--wood-header' }
	};
	// An L or any other notched room, as rectangles (slabs must be convex).
	const rects = (poly: typeof r.room): [number, number][][] =>
		polyRects(poly).map((b) => [
			[b.x0, b.y0],
			[b.x1, b.y0],
			[b.x1, b.y1],
			[b.x0, b.y1]
		]);
	const room = rects(r.room);
	const lay = rects(r.lay);
	const stack = floorStack(s);
	const top = stack[stack.length - 1];
	const all = (polys: [number, number][][], y0: number, h: number, mat: string) => polys.forEach((poly) => slabs.push({ poly, y0, h, mat }));
	for (const l of stack.slice(0, -1)) all(l.full ? room : lay, l.y0, l.h, l.y0 < 0 ? 'sub' : l.full ? 'under' : 'bed');
	if (r.approx) all(lay, top.y0, top.h, 'a');
	else {
		// Grout fills the joints a little under the faces.
		if (!plank && s.joint > 0) all(lay, top.y0, top.h * 0.85, 'bed');
		// Alternate plank shades so the rows read.
		r.pieces.forEach((p, i) => {
			const shade = plank ? (i * 7) % 3 === 0 : p.type === 1;
			const mat = p.thin ? 'thin' : (shade ? 'b' : 'a') + (p.cut && !plank ? 'c' : '');
			for (const part of p.laid) slabs.push({ poly: part as [number, number][], y0: top.y0, h: top.h, mat });
		});
	}
	// Low walls, cut off a hand's width over the floor, doorways open.
	const H = 14;
	const ft = top.y0 + top.h;
	r.walls.forEach((w, i) => {
		const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
		const doors = [...(r.doorsAt[i] ?? [])].sort((x, y) => x.at - y.at);
		const open: [number, number][] = [];
		let at = -WALL_T;
		for (const d of doors) {
			open.push([at, Math.max(at, d.at)]);
			at = d.at + d.width;
		}
		open.push([at, len + WALL_T]);
		const ry = Math.atan2(-w.d[1], w.d[0]);
		const box = (a: number, b: number, y0: number, h: number, off: number, depth: number, mat: string) => {
			const m = (a + b) / 2;
			solids.push({ c: [w.a[0] + w.d[0] * m + w.n[0] * off, y0 + h / 2, w.a[1] + w.d[1] * m + w.n[1] * off], s: [b - a, h, depth], ry, mat });
		};
		for (const [a, b] of open) {
			if (b - a < 0.05) continue;
			box(a, b, 0, H, -WALL_T / 2, WALL_T, 'wall');
			if (s.base) box(Math.max(0, a), Math.min(len, b), ft, BASE_H, BASE_T / 2, BASE_T, 'base');
		}
	});
	return { solids, mats, slabs };
}
