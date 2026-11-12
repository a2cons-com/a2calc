// Floor tile and plank takeoff, laid out piece by piece.
//
// The room is a run of sides with square turns (inside faces, inches),
// less the gap left at the walls. A pattern is one or more tile shapes
// repeated on a lattice (straight, offset, herringbone, basketweave,
// hopscotch's big and small squares, hexagons, octagons with dots), set out
// from two reference lines snapped parallel and square to a chosen wall.
// Every piece is clipped to the room: full ones, cut ones and the
// thinnest cut along each wall are counted from the layout itself.
//
// Plan coordinates are inches, x to the right and y down (as on screen).

export type V2 = [number, number];
export type FloorMaterial = 'tile' | 'plank';
export type PatternId = 'grid' | 'offset' | 'herringbone' | 'basketweave' | 'hopscotch' | 'hex' | 'octagon';
export type LineKind = 'center' | 'wall' | 'offset' | 'door';

export interface FloorDoor {
	id: number;
	/** From the side's start to the near jamb. */
	at: number;
	width: number;
}
export interface FloorSide {
	id: number;
	length: number;
	/** The turn at this side's end, into the next one. */
	turn: 'left' | 'right';
	doors: FloorDoor[];
}
/** A chalk line: through the room's middle, at the full-piece edge off a
 *  wall, a set distance off a wall, or through a doorway's middle. */
export interface LineRef {
	kind: LineKind;
	/** The wall it is measured from (wall and offset). */
	side: number;
	value: number;
	/** The doorway it runs through (door), by id. */
	door: number;
}
export interface FloorInput {
	material: FloorMaterial;
	/** A plain rectangle: sides 3 and 4 follow 1 and 2. */
	rect: boolean;
	sides: FloorSide[];
	pattern: PatternId;
	/** The main piece: width and length (a square's or a hexagon's or an
	 *  octagon's size across the flats is the width). */
	tileW: number;
	tileL: number;
	/** The small piece: hopscotch's small square, octagon's dot. */
	small: number;
	/** Offset pattern: how far each row steps, as a share of the length. */
	offset: number;
	/** Turned off the walls: 45° (30° for hexagons). */
	turned: boolean;
	joint: number;
	/** Left at the walls (expansion or movement). */
	gap: number;
	/** The wall the rows run along. */
	along: number;
	/** The line parallel to that wall, and the one square to it. */
	lineA: LineRef;
	lineB: LineRef;
	/** Where a center, offset or doorway line falls: on a joint, or down a piece's middle. */
	onLine: 'joint' | 'center';
	extraPct: number;
	boxSqft: number;
	box2Sqft: number;
	/** Mosaic on sheets: ordered by the sheet. */
	sheet: boolean;
	sheetSqft: number;
	/** Tile thickness: the grout's depth. */
	thick: number;
	/** Underlayment roll or sheet coverage; 0 for none. */
	rollSqft: number;
	base: boolean;
}

export const PATTERNS: { id: PatternId; name: string; turn: string }[] = [
	{ id: 'grid', name: 'Straight', turn: 'Diagonal, 45°' },
	{ id: 'offset', name: 'Offset', turn: 'Diagonal, 45°' },
	{ id: 'herringbone', name: 'Herringbone', turn: 'Pieces square to the walls' },
	{ id: 'basketweave', name: 'Basketweave', turn: 'Diagonal, 45°' },
	{ id: 'hopscotch', name: 'Hopscotch', turn: 'Diagonal, 45°' },
	{ id: 'hex', name: 'Hexagon', turn: 'Points to the wall' },
	{ id: 'octagon', name: 'Octagon & dot', turn: 'Diagonal, 45°' }
];
export const OFFSETS: [number, string][] = [
	[1 / 2, '½'],
	[1 / 3, '⅓'],
	[1 / 4, '¼']
];

/** Piece names and sizes, for the lists. */
export function pieceTypes(s: FloorInput): { name: string; w: number; l: number }[] {
	switch (s.pattern) {
		case 'hopscotch':
			return [
				{ name: 'Large', w: s.tileW, l: s.tileW },
				{ name: 'Small', w: s.small, l: s.small }
			];
		case 'hex':
			return [{ name: 'Hexagon', w: s.tileW, l: (s.tileW * 2) / Math.sqrt(3) }];
		case 'octagon':
			return [
				{ name: 'Octagon', w: s.tileW, l: s.tileW },
				{ name: 'Dot', w: s.small, l: s.small }
			];
		default:
			return [{ name: s.material === 'plank' ? 'Plank' : 'Tile', w: s.tileW, l: s.tileL }];
	}
}

// --- geometry -------------------------------------------------------------

const add = (a: V2, b: V2, k = 1): V2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0];
const right = (d: V2): V2 => [-d[1] + 0, d[0] + 0];
const left = (d: V2): V2 => [d[1] + 0, -d[0] + 0];

/** Shoelace area, signed: positive when the inside is right of the walls. */
export function signedArea(p: V2[]): number {
	let s = 0;
	for (let i = 0; i < p.length; i++) s += cross(p[i], p[(i + 1) % p.length]);
	return s / 2;
}

/** Corners of the sides, from the first one's start heading right. */
export function roomCorners(sides: FloorSide[]): { pts: V2[]; dirs: V2[]; miss: number } {
	let o: V2 = [0, 0];
	let d: V2 = [1, 0];
	const pts: V2[] = [];
	const dirs: V2[] = [];
	for (const s of sides) {
		pts.push(o);
		dirs.push(d);
		o = add(o, d, Math.max(0, s.length));
		d = s.turn === 'right' ? right(d) : left(d);
	}
	return { pts, dirs, miss: Math.hypot(o[0], o[1]) };
}

/** Each corner moved in by `g` off both walls it joins (square corners). */
function insetSquare(pts: V2[], normals: V2[], g: number): V2[] {
	const n = pts.length;
	return pts.map((p, i) => add(add(p, normals[(i - 1 + n) % n], g), normals[i], g));
}

/** A convex polygon shrunk by `d` off every edge (a tile from its module). */
export function inset(poly: V2[], d: number): V2[] {
	if (d <= 0) return poly;
	const n = poly.length;
	const s = Math.sign(signedArea(poly)) || 1;
	const lines = poly.map((p, i) => {
		const q = poly[(i + 1) % n];
		const e: V2 = [q[0] - p[0], q[1] - p[1]];
		const L = Math.hypot(e[0], e[1]) || 1;
		const nrm: V2 = [(-e[1] / L) * s, (e[0] / L) * s];
		return { p: add(p, nrm, d), e };
	});
	return lines.map((l2, i) => {
		const l1 = lines[(i - 1 + n) % n];
		const den = cross(l1.e, l2.e);
		if (Math.abs(den) < 1e-12) return l2.p;
		const t = cross([l2.p[0] - l1.p[0], l2.p[1] - l1.p[1]], l2.e) / den;
		return add(l1.p, l1.e, t);
	});
}

function inside(p: V2, poly: V2[]): boolean {
	let c = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i];
		const b = poly[j];
		if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
	}
	return c;
}

export interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** A square-cornered outline as rectangles (rows of grid cells). */
export function polyRects(poly: V2[]): Box[] {
	const xs = [...new Set(poly.map((p) => +p[0].toFixed(6)))].sort((a, b) => a - b);
	const ys = [...new Set(poly.map((p) => +p[1].toFixed(6)))].sort((a, b) => a - b);
	const out: Box[] = [];
	for (let j = 0; j + 1 < ys.length; j++) {
		let run: Box | null = null;
		for (let i = 0; i + 1 < xs.length; i++) {
			const inn = inside([(xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2], poly);
			if (inn && run && run.x1 === xs[i]) run.x1 = xs[i + 1];
			else if (inn) {
				run = { x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1] };
				out.push(run);
			} else run = null;
		}
	}
	return out;
}

/** Sutherland-Hodgman: a polygon cut to a rectangle. */
export function clipBox(poly: V2[], r: Box): V2[] {
	const tests: ((p: V2) => number)[] = [(p) => p[0] - r.x0, (p) => r.x1 - p[0], (p) => p[1] - r.y0, (p) => r.y1 - p[1]];
	let out = poly;
	for (const f of tests) {
		const inp = out;
		out = [];
		for (let i = 0; i < inp.length; i++) {
			const a = inp[i];
			const b = inp[(i + 1) % inp.length];
			const fa = f(a);
			const fb = f(b);
			if (fa >= 0) out.push(a);
			if (fa >= 0 !== fb >= 0) {
				const t = fa / (fa - fb);
				out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
			}
		}
		if (!out.length) return out;
	}
	return out;
}

const area = (p: V2[]) => Math.abs(signedArea(p));
const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [
	[x0, y0],
	[x1, y0],
	[x1, y1],
	[x0, y1]
];

// --- patterns -------------------------------------------------------------

/** One repeat of a pattern, in module sizes (each piece plus its joint),
 *  in the rows' own frame: s along the rows, t across them. */
interface Repeat {
	pieces: { type: number; poly: V2[] }[];
	a: V2;
	b: V2;
	/** The middle of the first piece (for a piece centered on a line). */
	mid: V2;
	/** Turned off the walls, degrees. */
	turn: number;
	warn?: string;
}

function rot(p: V2, deg: number): V2 {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

function repeat(s: FloorInput): Repeat {
	const j = Math.max(0, s.joint);
	const W = Math.max(0.25, s.tileW) + j;
	const L = Math.max(0.25, s.tileL) + j;
	const turn45 = s.turned ? 45 : 0;
	switch (s.pattern) {
		case 'offset': {
			const f = Math.max(0, Math.min(1, s.offset));
			return { pieces: [{ type: 0, poly: rect(0, 0, L, W) }], a: [L, 0], b: [f * L, W], mid: [L / 2, W / 2], turn: turn45 };
		}
		case 'herringbone': {
			// A zigzag of upright and lying pieces stepping (W, -W); the next
			// zigzag over by (L, L). Turned so the zigzag runs along the rows.
			const pieces = [
				{ type: 0, poly: rect(0, 0, W, L) },
				{ type: 0, poly: rect(W, L - W, W + L, L) }
			];
			const t = (p: V2) => rot(p, 45);
			return {
				pieces: pieces.map((q) => ({ type: q.type, poly: q.poly.map(t) })),
				a: t([W, -W]),
				b: t([L, L]),
				mid: t([W / 2, L / 2]),
				turn: s.turned ? -45 : 0,
				warn: L < 2 * W - 1e-6 ? 'Herringbone needs pieces at least twice as long as they are wide.' : undefined
			};
		}
		case 'basketweave': {
			// Squares of n pieces side by side, every other square turned.
			const n = Math.max(1, Math.round(L / W));
			const S = L;
			const w = S / n;
			const pieces: Repeat['pieces'] = [];
			for (let i = 0; i < n; i++) {
				pieces.push({ type: 0, poly: rect(0, i * w, S, (i + 1) * w) });
				pieces.push({ type: 0, poly: rect(S + i * w, 0, S + (i + 1) * w, S) });
			}
			return {
				pieces,
				a: [2 * S, 0],
				b: [S, S],
				mid: [S / 2, w / 2],
				turn: turn45,
				warn: Math.abs(w - W) > 1 / 16 ? `Basketweave needs the length to be ${n} widths (with joints): ${n} × the width plus ${n - 1} joints.` : undefined
			};
		}
		case 'hopscotch': {
			const A = Math.max(0.25, s.tileW) + j;
			const B = Math.min(A - j - 0.25, Math.max(0.25, s.small)) + j;
			return {
				pieces: [
					{ type: 0, poly: rect(0, 0, A, A) },
					{ type: 1, poly: rect(A, 0, A + B, B) }
				],
				a: [A, B],
				b: [-B, A],
				mid: [A / 2, A / 2],
				turn: turn45
			};
		}
		case 'hex': {
			// Flats square to the rows; the rows nest half a piece over.
			const F = W;
			const h = F / Math.sqrt(3);
			const poly: V2[] = [
				[0, -h],
				[F / 2, -h / 2],
				[F / 2, h / 2],
				[0, h],
				[-F / 2, h / 2],
				[-F / 2, -h / 2]
			];
			return { pieces: [{ type: 0, poly }], a: [F, 0], b: [F / 2, (F * Math.sqrt(3)) / 2], mid: [0, 0], turn: s.turned ? 30 : 0 };
		}
		case 'octagon': {
			// Octagons on a square grid; a dot fills each corner between four.
			const F = W;
			const c = Math.min(F / 2 - 0.1, (Math.max(0.25, s.small) + j) / Math.SQRT2);
			const oct: V2[] = [
				[c, 0],
				[F - c, 0],
				[F, c],
				[F, F - c],
				[F - c, F],
				[c, F],
				[0, F - c],
				[0, c]
			];
			const dotP: V2[] = [
				[c, 0],
				[0, c],
				[-c, 0],
				[0, -c]
			];
			return {
				pieces: [
					{ type: 0, poly: oct },
					{ type: 1, poly: dotP }
				],
				a: [F, 0],
				b: [0, F],
				mid: [F / 2, F / 2],
				turn: turn45
			};
		}
		default:
			return { pieces: [{ type: 0, poly: rect(0, 0, L, W) }], a: [L, 0], b: [0, W], mid: [L / 2, W / 2], turn: turn45 };
	}
}

// --- the takeoff ----------------------------------------------------------

export interface FloorPiece {
	type: number;
	/** The whole piece where it lies. */
	poly: V2[];
	cut: boolean;
	/** A cut thinner than a third of the piece (or 2″). */
	thin: boolean;
	/** Narrowest width of what is left after cutting. */
	width: number;
}
export interface FloorLine {
	/** Ends of the chalk line across the room. */
	p: V2;
	q: V2;
	/** Measured from this wall, this far. */
	side: number;
	dist: number;
	label: string;
}
export interface FloorType {
	name: string;
	w: number;
	l: number;
	/** One piece, sq in. */
	area: number;
	full: number;
	cut: number;
	/** Pieces needed before extra (cuts each take a whole piece). */
	need: number;
	order: number;
	boxes: number;
	boxSqft: number;
}
export interface FloorResult {
	/** The room's inside faces, and what is laid (less the gap at the walls). */
	room: V2[];
	lay: V2[];
	/** Each side: start, end, inward normal. */
	walls: { a: V2; b: V2; n: V2; d: V2 }[];
	miss: number;
	area: number;
	layArea: number;
	perimeter: number;
	doors: number;
	baseLf: number;
	types: FloorType[];
	pieces: FloorPiece[];
	/** Too many pieces to lay one by one (a mosaic): counted by area. */
	approx: boolean;
	lines: [FloorLine, FloorLine];
	/** Narrowest cut along each wall (null: none cut there). */
	wallCuts: (number | null)[];
	smallest: number | null;
	/** Tile laid, sq in (the pieces as cut). */
	covered: number;
	sheets: number;
	grout: { lbs: number; bags: number; sanded: boolean } | null;
	thinset: { trowel: string; bags: number } | null;
	rolls: number;
	warnings: string[];
}

export const TROWELS: { max: number; name: string; sqft: number }[] = [
	{ max: 4, name: '3/16″ V', sqft: 100 },
	{ max: 8, name: '1/4″ × 1/4″ square', sqft: 95 },
	{ max: 16, name: '1/4″ × 3/8″ square', sqft: 65 },
	{ max: Infinity, name: '1/2″ × 1/2″ square', sqft: 45 }
];
/** Mixed grout, lb per cubic inch. */
const GROUT_DENSITY = 0.06;
const MAX_PIECES = 12000;

/** Sides with the rectangle's 3 and 4 copied from 1 and 2. */
export function floorSides(s: FloorInput): FloorSide[] {
	if (!s.rect || s.sides.length < 4) return s.sides;
	const [a, b, c, d] = s.sides;
	return [
		{ ...a, turn: 'right' },
		{ ...b, turn: 'right' },
		{ ...c, length: a.length, turn: 'right' },
		{ ...d, length: b.length, turn: 'right' }
	];
}

/** Walls parallel to wall k (k itself first), and those square to it. */
export function wallsBy(r: Pick<FloorResult, 'walls'>, k: number): { par: number[]; sq: number[] } {
	const d = r.walls[k]?.d ?? [1, 0];
	const par: number[] = [];
	const sq: number[] = [];
	r.walls.forEach((w, i) => (Math.abs(dot(w.d, d)) > 0.5 ? par : sq).push(i));
	par.sort((x, y) => (x === k ? -1 : y === k ? 1 : 0));
	return { par, sq };
}

export function flooring(s: FloorInput): FloorResult {
	const sides = floorSides(s);
	const warnings: string[] = [];
	const { pts, dirs, miss } = roomCorners(sides);
	const orient = Math.sign(signedArea(pts)) || 1;
	const normals = dirs.map((d) => (orient > 0 ? right(d) : left(d)));
	const walls = pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length], n: normals[i], d: dirs[i] }));
	if (miss > 0.25) warnings.push(`The sides miss closing by ${miss.toFixed(2)}″: check the lengths and turns.`);
	const gap = Math.max(0, s.gap);
	const lay = insetSquare(pts, normals, gap);
	const room = pts;
	const areaIn = area(room);
	const layArea = area(lay);
	const perimeter = sides.reduce((t, x) => t + Math.max(0, x.length), 0);
	const doorList = sides.flatMap((x, i) => x.doors.map((d) => ({ ...d, side: i })));
	const baseLf = Math.max(0, perimeter - doorList.reduce((t, d) => t + d.width, 0)) / 12;

	// The frame: rows along wall k, the reference lines through o.
	const k = Math.max(0, Math.min(walls.length - 1, s.along));
	const u = walls[k]?.d ?? [1, 0];
	const v = walls[k]?.n ?? [0, 1];
	const types0 = pieceTypes(s);
	const rep = repeat(s);
	if (rep.warn) warnings.push(rep.warn);
	const j = Math.max(0, s.joint);
	const { par, sq } = wallsBy({ walls }, k);
	const proj = (p: V2, ax: V2) => dot(p, ax);
	const extent = (ax: V2) => {
		const vals = room.map((p) => proj(p, ax));
		return [Math.min(...vals), Math.max(...vals)] as const;
	};
	/** Where a line falls on its axis, and whether a piece edge (not a joint's middle) sits on it. */
	function place(ref: LineRef, ax: V2, allowed: number[]): { c: number; side: number; edge: boolean } {
		// A center or doorway line is measured from the outermost wall it parallels.
		const outer = allowed.reduce((m, i) => (proj(walls[i].a, ax) < proj(walls[m].a, ax) ? i : m), allowed[0] ?? k);
		const side = ref.kind === 'center' || ref.kind === 'door' ? outer : allowed.includes(ref.side) ? ref.side : allowed[0] ?? k;
		const w = walls[side];
		const wc = w ? proj(w.a, ax) : 0;
		const sign = w ? Math.sign(dot(w.n, ax)) || 1 : 1;
		if (ref.kind === 'wall') return { c: wc + sign * gap, side, edge: true };
		if (ref.kind === 'offset') return { c: wc + sign * ref.value, side, edge: false };
		if (ref.kind === 'door') {
			const d = doorList.find((x) => x.id === ref.door);
			if (d) {
				const ww = walls[d.side];
				const m = add(ww.a, ww.d, d.at + d.width / 2);
				return { c: proj(m, ax), side, edge: false };
			}
		}
		const [lo, hi] = extent(ax);
		return { c: (lo + hi) / 2, side, edge: false };
	}
	const A = place(s.lineA, v, par);
	const B = place(s.lineB, u, sq);

	// The repeat's frame, turned off the walls.
	const tu = rot(u, rep.turn);
	const tv = rot(v, rep.turn);
	const toWorld = (p: V2, o: V2): V2 => add(add(o, tu, p[0]), tv, p[1]);
	// The lines' crossing; then shift the repeat so a joint's middle (or a
	// piece's middle, or a piece's edge at a wall) is on each line.
	const cross0: V2 = add([0, 0], v, A.c);
	const crossing: V2 = add(cross0, u, B.c);
	const centered = s.onLine === 'center';
	/** In the repeat's frame, the point that goes on the crossing. */
	let anchor: V2 = centered ? rep.mid : [0, 0];
	if (rep.turn === 0) {
		// A wall line puts a piece's edge on it: the module starts half a
		// joint short of it (or ends half a joint past it, off a far wall).
		const edgeAt = (side: number, ax: V2) => (Math.sign(dot(walls[side]?.n ?? ax, ax)) < 0 ? -j / 2 : j / 2);
		anchor = [B.edge ? edgeAt(B.side, u) : centered ? rep.mid[0] : 0, A.edge ? edgeAt(A.side, v) : centered ? rep.mid[1] : 0];
	}
	const o: V2 = add(add(crossing, tu, -anchor[0]), tv, -anchor[1]);

	// Lay every repeat that can reach the room.
	const rects = polyRects(lay);
	const bb = lay.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
	const cellArea = Math.abs(cross(rep.a, rep.b));
	const approx = layArea / Math.max(1e-6, cellArea) * rep.pieces.length > MAX_PIECES;
	const tiles = rep.pieces.map((p) => inset(p.poly, j / 2));
	const tileArea = tiles.map(area);
	const counts = types0.map(() => ({ full: 0, cut: 0 }));
	const pieces: FloorPiece[] = [];
	const wallCuts: (number | null)[] = walls.map(() => null);
	let smallest: number | null = null;
	let covered = 0;
	const minDim = types0.map((t) => Math.min(t.w, t.l));

	if (!approx && rects.length) {
		// Lattice range: the room's corners in lattice coordinates.
		const det = cross(rep.a, rep.b);
		const corners: V2[] = [
			[bb[0], bb[1]],
			[bb[2], bb[1]],
			[bb[2], bb[3]],
			[bb[0], bb[3]]
		];
		let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
		for (const c of corners) {
			const rel: V2 = [c[0] - o[0], c[1] - o[1]];
			const loc: V2 = [dot(rel, tu), dot(rel, tv)];
			const ia = cross(loc, rep.b) / det;
			const ib = cross(rep.a, loc) / det;
			i0 = Math.min(i0, ia);
			i1 = Math.max(i1, ia);
			j0 = Math.min(j0, ib);
			j1 = Math.max(j1, ib);
		}
		const pad = 3;
		for (let ia = Math.floor(i0) - pad; ia <= Math.ceil(i1) + pad; ia++)
			for (let ib = Math.floor(j0) - pad; ib <= Math.ceil(j1) + pad; ib++) {
				const shift: V2 = add([rep.a[0] * ia, rep.a[1] * ia], rep.b, ib);
				rep.pieces.forEach((rp, pi) => {
					const poly = tiles[pi].map((p) => toWorld(add(p, shift), o));
					let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
					for (const p of poly) {
						x0 = Math.min(x0, p[0]);
						x1 = Math.max(x1, p[0]);
						y0 = Math.min(y0, p[1]);
						y1 = Math.max(y1, p[1]);
					}
					if (x1 <= bb[0] || x0 >= bb[2] || y1 <= bb[1] || y0 >= bb[3]) return;
					let got = 0;
					const parts: V2[][] = [];
					for (const r of rects) {
						if (x1 <= r.x0 || x0 >= r.x1 || y1 <= r.y0 || y0 >= r.y1) continue;
						const c = clipBox(poly, r);
						if (c.length < 3) continue;
						const a = area(c);
						if (a > 1e-6) {
							got += a;
							parts.push(c);
						}
					}
					const full = tileArea[pi];
					if (got < Math.max(0.05, full * 0.002)) return;
					covered += got;
					const cut = got < full * 0.999;
					let width = Infinity;
					if (cut) {
						// Narrowest across the piece's own edge directions.
						const pts2 = parts.flat();
						for (let e = 0; e < poly.length; e++) {
							const a = poly[e];
							const b = poly[(e + 1) % poly.length];
							const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
							const nrm: V2 = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
							const vals = pts2.map((p) => dot(p, nrm));
							width = Math.min(width, Math.max(...vals) - Math.min(...vals));
						}
						smallest = smallest === null ? width : Math.min(smallest, width);
						walls.forEach((w, wi) => {
							const la = lay[wi];
							const lb = lay[(wi + 1) % lay.length];
							const len = Math.hypot(lb[0] - la[0], lb[1] - la[1]) || 1;
							const dd: V2 = [(lb[0] - la[0]) / len, (lb[1] - la[1]) / len];
							const on = pts2.some((p) => {
								const rel: V2 = [p[0] - la[0], p[1] - la[1]];
								const t = dot(rel, dd);
								return Math.abs(cross(dd, rel)) < 0.01 && t > 0.01 && t < len - 0.01;
							});
							if (on) wallCuts[wi] = wallCuts[wi] === null ? width : Math.min(wallCuts[wi]!, width);
						});
					}
					const ty = rp.type;
					if (cut) counts[ty].cut++;
					else counts[ty].full++;
					pieces.push({ type: ty, poly, cut, thin: cut && !s.sheet && width < Math.min(2, minDim[ty] / 3), width: cut ? width : Infinity });
				});
			}
	}

	// Order: pieces from the layout, or by area where offcuts start the
	// next row (planks in rows) or the pieces are too many to lay out.
	const extra = 1 + Math.max(0, s.extraPct) / 100;
	const reuse = s.material === 'plank' && (s.pattern === 'grid' || s.pattern === 'offset');
	const perCell = types0.map((_, ti) => rep.pieces.filter((p) => p.type === ti).length);
	const types: FloorType[] = types0.map((t, ti) => {
		const a = ti === 0 && s.pattern === 'hex' ? (Math.sqrt(3) / 2) * t.w * t.w : s.pattern === 'octagon' && ti === 0 ? tileArea[0] : t.w * t.l;
		const byArea = Math.ceil((layArea * perCell[ti]) / Math.max(1e-6, cellArea) - 1e-9);
		const need = approx || reuse ? byArea : counts[ti].full + counts[ti].cut;
		const order = Math.ceil(need * extra - 1e-9);
		const boxSqft = ti === 0 ? s.boxSqft : s.box2Sqft;
		return { name: t.name, w: t.w, l: t.l, area: a, full: counts[ti].full, cut: counts[ti].cut, need, order, boxes: boxSqft > 0 ? Math.ceil((order * a) / 144 / boxSqft - 1e-9) : 0, boxSqft };
	});
	const sheets = s.sheet && s.sheetSqft > 0 ? Math.ceil(((layArea / 144) * extra) / s.sheetSqft - 1e-9) : 0;

	// Lines, for the drawing and the layout notes.
	const [ulo, uhi] = extent(u);
	const [vlo, vhi] = extent(v);
	const lineFor = (pos: { c: number; side: number }, ax: V2, other: V2, lo: number, hi: number, which: string): FloorLine => {
		const w = walls[pos.side];
		const dist = w ? Math.abs(pos.c - proj(w.a, ax)) : 0;
		const p = add(add([0, 0], ax, pos.c), other, lo);
		const q = add(add([0, 0], ax, pos.c), other, hi);
		return { p, q, side: pos.side, dist, label: `${which}` };
	};
	const lines: [FloorLine, FloorLine] = [lineFor(A, v, u, ulo, uhi, 'A'), lineFor(B, u, v, vlo, vhi, 'B')];

	let grout: FloorResult['grout'] = null;
	let thinset: FloorResult['thinset'] = null;
	let rolls = 0;
	if (s.material === 'tile') {
		const tiled = tileArea.reduce((t, x) => t + x, 0);
		const share = Math.max(0, 1 - tiled / Math.max(1e-6, cellArea));
		const lbs = layArea * share * Math.max(0, s.thick) * GROUT_DENSITY * 1.1;
		grout = j > 0 ? { lbs, bags: Math.ceil(lbs / 25 - 1e-9), sanded: j > 1 / 8 + 1e-6 } : null;
		const big = Math.max(...types0.map((t) => Math.max(t.w, t.l)));
		const tr = TROWELS.find((t) => big <= t.max)!;
		thinset = { trowel: tr.name, bags: Math.ceil(layArea / 144 / tr.sqft - 1e-9) };
		if (big > 15) warnings.push('Large tile: back-butter it too, about a quarter more thinset.');
	}
	if (s.rollSqft > 0) rolls = Math.ceil(((areaIn / 144) * 1.05) / s.rollSqft - 1e-9);
	if (smallest !== null && pieces.some((p) => p.thin)) warnings.push('Some cuts are slivers (red): move a line, or try Best fit.');

	return {
		room,
		lay,
		walls,
		miss,
		area: areaIn,
		layArea,
		perimeter,
		doors: doorList.length,
		baseLf,
		types,
		pieces,
		approx,
		lines,
		wallCuts,
		smallest,
		covered,
		sheets,
		grout,
		thinset,
		rolls,
		warnings
	};
}

/** Distances for the two lines that leave the widest smallest cut (each
 *  measured from its line's wall), trying shifts across one repeat. */
export function bestFit(s: FloorInput, steps = 16): { a: number; b: number } | null {
	const base = flooring(s);
	if (base.approx || !base.walls.length) return null;
	const k = Math.max(0, Math.min(base.walls.length - 1, s.along));
	const { par, sq } = wallsBy(base, k);
	const sa = par.includes(s.lineA.side) ? s.lineA.side : par[0];
	const sb = sq.includes(s.lineB.side) ? s.lineB.side : sq[0];
	const rep = repeat(s);
	const span = Math.max(Math.hypot(...rep.a), Math.hypot(...rep.b));
	const types = pieceTypes(s);
	const minDim = types.map((t) => Math.min(t.w, t.l));
	// Start from the middle of the room on both lines.
	const mid = (side: number, ax: V2) => {
		const vals = base.room.map((p) => dot(p, ax));
		return Math.abs((Math.min(...vals) + Math.max(...vals)) / 2 - dot(base.walls[side].a, ax));
	};
	const a0 = mid(sa, base.walls[k].n);
	const b0 = sb === undefined ? 0 : mid(sb, base.walls[k].d);
	let best: { a: number; b: number; score: number; n: number } | null = null;
	for (let i = 0; i < steps; i++)
		for (let q = 0; q < steps; q++) {
			const a = a0 + (i / steps - 0.5) * span;
			const b = b0 + (q / steps - 0.5) * span;
			const r = flooring({ ...s, lineA: { ...s.lineA, kind: 'offset', side: sa, value: a }, lineB: { ...s.lineB, kind: 'offset', side: sb ?? s.lineB.side, value: b } });
			let score = Infinity;
			for (const p of r.pieces) if (p.cut) score = Math.min(score, p.width / minDim[p.type]);
			const n = r.pieces.length;
			if (!best || score > best.score + 1e-6 || (Math.abs(score - best.score) <= 1e-6 && n < best.n)) best = { a, b, score, n };
		}
	return best ? { a: Math.round(best.a * 16) / 16, b: Math.round(best.b * 16) / 16 } : null;
}
