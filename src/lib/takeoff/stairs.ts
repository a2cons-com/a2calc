// A straight stair between two floor levels: risers and treads from the
// finished rise, flights split by landings, the stringer layout (rough
// cuts, adjusted for the finish floors and the tread thickness), the
// floor opening headroom needs, and checks against the code limits.
//
// Elevations are inches above the top of the lower rough floor (slab or
// subfloor); x runs from the face of the bottom riser toward the top.

import { formatFtIn } from '$lib/calc/units';

export type StairCode = 'irc' | 'ibc';

export interface StairInput {
	code: StairCode;
	/** Rough floor to rough floor: top of the lower slab or subfloor to the
	 *  top of the upper subfloor. */
	rise: number;
	/** Finish floor still to go on, at the bottom and at the top. */
	finishBottom: number;
	finishTop: number;
	/** Number of risers, or null to pick the fewest the code allows. */
	risers: number | null;
	/** Tread run, nosing to nosing. */
	tread: number;
	nosing: number;
	treadThk: number;
	riserThk: number;
	width: number;
	/** Intermediate landings, or null for only those the code needs. */
	landings: number | null;
	landingDepth: number;
	/** Landings placed by hand: where each one is (risers below it) and
	 *  how deep. Null (or missing) to space them evenly at landingDepth. */
	spots?: LandingSpot[] | null;
	/** Upper floor structure: joists plus subfloor. */
	floorDepth: number;
	stringer: StringerSize;
}

/** Which way the stair goes on from a landing: straight on, a quarter
 *  turn (L) or a half turn (U), to the left or right walking up. */
export type Turn = 'straight' | 'left' | 'right' | 'u-left' | 'u-right';
export const TURNS: [Turn, string][] = [
	['straight', 'Straight'],
	['left', 'L left'],
	['right', 'L right'],
	['u-left', 'U left'],
	['u-right', 'U right']
];

/** A corner cut out of a landing, for a wall or a post. Corners are named
 *  walking up onto the landing: near is the riser side. */
export type NotchCorner = 'near-left' | 'near-right' | 'far-left' | 'far-right';
export interface Notch {
	corner: NotchCorner;
	/** Along the arriving flight, and across it. */
	along: number;
	across: number;
}

/** A landing placed by hand: `at` risers below it, `depth` past the last
 *  riser in the direction of travel. The rest is optional. */
export interface LandingSpot {
	at: number;
	depth: number;
	turn?: Turn;
	/** L turns: the space between the last riser below and the flight
	 *  above (null: what the code asks for, mostly none). */
	past?: number | null;
	/** L turns: the space between the side of the flight below and the
	 *  first riser above. U turns: how far that riser sits back from the
	 *  last one below (0: they line up). Null: as for `past`, or 0. */
	next?: number | null;
	/** Width of the flight above, if it changes (null: the same). */
	width?: number | null;
	/** U turns: space between the two flights (a well, or a wall). */
	gap?: number | null;
	notch?: Notch | null;
}

/** Plan point: x, and y down the screen (the 3D z). */
export type V2 = [number, number];
/** A rectangle: along (a0..a1) and across (c0..c1) in some frame. */
export interface Rect {
	a0: number;
	a1: number;
	c0: number;
	c1: number;
}

/** The right-hand side, walking along d (y runs down the screen). */
export const rightOf = (d: V2): V2 => [-d[1] || 0, d[0] || 0];
const back = (d: V2): V2 => [-d[0] || 0, -d[1] || 0];
/** A point `along` and `across` (to the right) from o heading d. */
export const toPlan = (o: V2, d: V2, along: number, across: number): V2 => {
	const s = rightOf(d);
	return [o[0] + along * d[0] + across * s[0], o[1] + along * d[1] + across * s[1]];
};
/** A rectangle in a frame (axis-aligned headings only) as a plan rect. */
export function rectToPlan(o: V2, d: V2, r: Rect): Rect {
	const p = toPlan(o, d, r.a0, r.c0);
	const q = toPlan(o, d, r.a1, r.c1);
	return { a0: Math.min(p[0], q[0]), a1: Math.max(p[0], q[0]), c0: Math.min(p[1], q[1]), c1: Math.max(p[1], q[1]) };
}

/** Rectangles less holes, on the grid their edges make: the covered cells
 *  merged along rows (to draw as boxes), and the outline loops. */
export function cells(rects: Rect[], holes: Rect[] = []): { boxes: Rect[]; loops: V2[][] } {
	const xs = [...new Set(rects.concat(holes).flatMap((r) => [r.a0, r.a1]))].sort((a, b) => a - b);
	const ys = [...new Set(rects.concat(holes).flatMap((r) => [r.c0, r.c1]))].sort((a, b) => a - b);
	const inside = (r: Rect, x: number, y: number) => x > r.a0 && x < r.a1 && y > r.c0 && y < r.c1;
	const nx = xs.length - 1;
	const ny = ys.length - 1;
	const cov: boolean[][] = [];
	for (let i = 0; i < nx; i++) {
		cov.push([]);
		for (let j = 0; j < ny; j++) {
			const x = (xs[i] + xs[i + 1]) / 2;
			const y = (ys[j] + ys[j + 1]) / 2;
			cov[i].push(xs[i + 1] - xs[i] > EPS && ys[j + 1] - ys[j] > EPS && rects.some((r) => inside(r, x, y)) && !holes.some((r) => inside(r, x, y)));
		}
	}
	const at = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && cov[i][j];
	const boxes: Rect[] = [];
	for (let j = 0; j < ny; j++)
		for (let i = 0; i < nx; i++) {
			if (!cov[i][j]) continue;
			let k = i;
			while (at(k + 1, j)) k++;
			boxes.push({ a0: xs[i], a1: xs[k + 1], c0: ys[j], c1: ys[j + 1] });
			i = k;
		}
	// Boundary edges, each cell's outside sides in one turning sense.
	const edges = new Map<string, [number, number][]>();
	const key = (i: number, j: number) => `${i},${j}`;
	const add = (a: [number, number], b: [number, number]) => {
		const k = key(...a);
		if (!edges.has(k)) edges.set(k, []);
		edges.get(k)!.push(b);
	};
	for (let i = 0; i < nx; i++)
		for (let j = 0; j < ny; j++) {
			if (!cov[i][j]) continue;
			if (!at(i, j - 1)) add([i, j], [i + 1, j]);
			if (!at(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
			if (!at(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
			if (!at(i - 1, j)) add([i, j + 1], [i, j]);
		}
	const loops: V2[][] = [];
	for (const [k0, list] of edges) {
		while (list.length) {
			const [i0, j0] = k0.split(',').map(Number);
			const pts: [number, number][] = [[i0, j0]];
			let cur = list.pop()!;
			while (key(...cur) !== k0) {
				pts.push(cur);
				const next = edges.get(key(...cur));
				if (!next?.length) break;
				cur = next.pop()!;
			}
			// Drop the points along straight runs.
			const out = pts.filter((p, n) => {
				const a = pts[(n + pts.length - 1) % pts.length];
				const b = pts[(n + 1) % pts.length];
				return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
			});
			loops.push(out.map(([i, j]) => [xs[i], ys[j]]));
		}
	}
	return { boxes, loops };
}

/** Hand-placed landings made valid for `n` risers: in order, each at
 *  least a riser above the last, none at the floors. */
function normSpots(spots: LandingSpot[] | null | undefined, n: number): LandingSpot[] | null {
	if (!spots?.length || n < 2) return null;
	const list = [...spots].filter((p) => Number.isFinite(p.at)).sort((a, b) => a.at - b.at).slice(0, n - 1);
	if (!list.length) return null;
	let prev = 0;
	const len = (v: number | null | undefined, min: number) => (v == null || !Number.isFinite(v) ? null : Math.max(min, v));
	return list.map((p, i) => {
		const at = Math.min(n - (list.length - i), Math.max(prev + 1, Math.round(p.at)));
		prev = at;
		const turn = TURNS.some(([t]) => t === p.turn) ? p.turn : 'straight';
		const notch = p.notch && Number.isFinite(p.notch.along) && Number.isFinite(p.notch.across) ? { corner: p.notch.corner, along: Math.max(1, p.notch.along), across: Math.max(1, p.notch.across) } : null;
		return { at, depth: Number.isFinite(p.depth) ? Math.max(12, p.depth) : 36, turn, past: len(p.past, 0), next: len(p.next, -240), width: len(p.width, 12), gap: len(p.gap, 0), notch };
	});
}

export type StringerSize = '2x12' | '2x10';
export const STRINGER_DEPTH: Record<StringerSize, number> = { '2x12': 11.25, '2x10': 9.25 };

export interface CodeLimits {
	name: string;
	maxRiser: number;
	minRiser: number;
	minTread: number;
	minWidth: number;
	headroom: number;
	maxFlightRise: number;
	/** Landing depth: at least this, or (IBC) the width up to this. */
	minLanding: number;
	landingByWidth: boolean;
	/** Nosing range, needed when the tread is under `nosingUnder`. */
	nosing: [number, number];
	nosingUnder: number;
	handrail: [number, number];
	/** Handrail needed at this many risers. */
	handrailAt: number;
	guard: number;
	variation: number;
	sphere: number;
}

export const CODES: Record<StairCode, CodeLimits> = {
	irc: {
		name: 'IRC (homes)',
		maxRiser: 7.75,
		minRiser: 0,
		minTread: 10,
		minWidth: 36,
		headroom: 80,
		maxFlightRise: 151,
		minLanding: 36,
		landingByWidth: false,
		nosing: [0.75, 1.25],
		nosingUnder: 11,
		handrail: [34, 38],
		handrailAt: 4,
		guard: 36,
		variation: 0.375,
		sphere: 4
	},
	ibc: {
		name: 'IBC (commercial)',
		maxRiser: 7,
		minRiser: 4,
		minTread: 11,
		minWidth: 44,
		headroom: 80,
		maxFlightRise: 144,
		minLanding: 48,
		landingByWidth: true,
		nosing: [0, 1.25],
		nosingUnder: 0,
		handrail: [34, 38],
		handrailAt: 2,
		guard: 42,
		variation: 0.375,
		sphere: 4
	}
};

export interface Step {
	kind: 'tread' | 'landing' | 'top';
	/** Front (riser face) and back of the step. */
	x0: number;
	x1: number;
	/** Finished walking surface. */
	y: number;
	flight: number;
}

export interface Flight {
	risers: number;
	treads: number;
	/** Riser face at the bottom, and where it ends (landing or top floor). */
	x0: number;
	x1: number;
	/** Finished surface it starts from and climbs to. */
	y0: number;
	y1: number;
	/** What the stringer bears on at the bottom (rough). */
	seat: number;
	/** Finished rise and horizontal run of this flight (nosing to
	 *  nosing: first riser face to the landing or top floor edge). */
	rise: number;
	run: number;
	/** Stringer: rough cut heights from its seat, first and the rest. */
	firstRise: number;
	length: number;
	stock: number;
	/** Width, the stringers across it, and where it sits in plan: the
	 *  left edge at its first riser, heading d. */
	width: number;
	stringers: number;
	o: V2;
	d: V2;
}

/** A landing as figured: where it is, its turn and sizes, and its shape. */
export interface Landing extends LandingSpot {
	turn: Turn;
	/** As entered (to edit from). */
	src: LandingSpot;
	/** Depth past the arriving riser, and in front of the next one (the
	 *  landing's size in each direction of travel); the spaces as figured. */
	depth: number;
	before: number;
	past: number;
	next: number;
	gap: number;
	/** Widths of the flights below and above. */
	below: number;
	above: number;
	/** Finished height above the finished floor; framing top (rough). */
	height: number;
	framing: number;
	/** Along the unfolded run. */
	x0: number;
	x1: number;
	/** Frame: the arriving flight's left edge at its last riser, heading
	 *  on; the landing's pieces in that frame (along, across to the right). */
	o: V2;
	d: V2;
	rects: Rect[];
	holes: Rect[];
	/** Outline in plan, and its overall size along and across. */
	outline: V2[][];
	size: [number, number];
}

export interface StairResult {
	finishedRise: number;
	risers: number;
	riser: number;
	treads: number;
	run: number;
	angle: number;
	flights: Flight[];
	steps: Step[];
	landings: number;
	/** Each landing: risers below it, depth, finished height above the
	 *  finished floor, framing top above the rough floor, where it runs. */
	spots: Landing[];
	/** Landings placed by hand; any of them turning. */
	custom: boolean;
	turns: boolean;
	/** Plan: the floor past the top riser, the outline the stair covers
	 *  (a0..a1 = plan x, c0..c1 = plan y), and the floor opening there. */
	topFloor: Rect;
	bounds: Rect;
	openingPlan: { loops: V2[][]; boxes: Rect[]; size: [number, number] };
	/** Upper floor framing underside (rough). */
	ceiling: number;
	/** Floor opening needed for headroom, back from the top riser. */
	opening: number;
	/** Opening starts here (x). */
	openingAt: number;
	/** Stringer: notch depth, what's left below it, stringers across. */
	notch: number;
	throat: number;
	stringers: number;
	/** Stringer, top: last tread cut below the upper rough floor. */
	topDrop: number;
	/** Tread board depth and riser board height. */
	treadDepth: number;
	riserBoard: number;
	comfort: number;
	warnings: string[];
	hints: string[];
	limits: CodeLimits;
}

const EPS = 1e-6;

/** Most stringer spacing for a tread stock: thin (plywood) treads need
 *  them closer. */
export const stringerSpacing = (treadThk: number) => (treadThk >= 1 ? 18 : 12);

/** Stock lengths stringers come in: even feet from 8'. */
const stock = (len: number) => Math.max(96, Math.ceil(len / 24 - EPS) * 24);

export function stairs(s: StairInput): StairResult {
	const L = CODES[s.code] ?? CODES.irc;
	const pos = (v: number, min = 0) => Math.max(min, Number.isFinite(v) ? v : 0);
	const rise = pos(s.rise, 1);
	const fb = pos(s.finishBottom);
	const ftp = pos(s.finishTop);
	const T = pos(s.tread, 1);
	const tt = pos(s.treadThk);
	const finishedRise = Math.max(1, rise + ftp - fb);

	const autoRisers = Math.max(1, Math.ceil(finishedRise / L.maxRiser - EPS));
	const n = Math.max(1, Math.round(s.risers ?? autoRisers));
	const R = finishedRise / n;

	// Flights: at least enough that none climbs more than the code allows.
	const needFlights = Math.min(n, Math.max(1, Math.ceil(finishedRise / L.maxFlightRise - EPS)));
	const custom = normSpots(s.spots, n);
	const flightsN = custom ? custom.length + 1 : Math.min(n, Math.max(1, s.landings === null ? needFlights : Math.round(s.landings) + 1));
	const LD = pos(s.landingDepth, 12);
	const per = custom
		? custom.map((p, i) => p.at - (i ? custom[i - 1].at : 0)).concat(n - custom[custom.length - 1].at)
		: Array.from({ length: flightsN }, (_, i) => Math.floor(n / flightsN) + (i < n % flightsN ? 1 : 0));
	const W0 = pos(s.width, 12);
	const maxSpacing = stringerSpacing(tt);
	const stringersFor = (w: number) => Math.max(2, Math.ceil((w - 1.5) / maxSpacing - EPS) + 1);
	const need = (w: number) => (L.landingByWidth ? Math.min(L.minLanding, w) : L.minLanding);
	const spotIn = (i: number): LandingSpot => (custom ? custom[i] : { at: 0, depth: LD });

	const steps: Step[] = [];
	const flights: Flight[] = [];
	const lands: Omit<Landing, 'height' | 'framing'>[] = [];
	let x = 0;
	let y = fb;
	let o: V2 = [0, 0];
	let d: V2 = [1, 0];
	let w = W0;
	per.forEach((k, f) => {
		const x0 = x;
		const y0 = y;
		const last = f === flightsN - 1;
		const src = last ? null : spotIn(f);
		const turn: Turn = src?.turn ?? 'straight';
		const above = src?.width ?? w;
		// Depth past the riser: an L holds the flight above across it, plus
		// any space between; the code may ask for more.
		const ell = turn === 'left' || turn === 'right';
		const past = src && ell ? (src.past ?? Math.max(0, need(w) - above)) : 0;
		const A = src ? (ell ? above + past : src.depth) : 0;
		for (let r = 1; r <= k; r++) {
			y += R;
			if (r < k) {
				steps.push({ kind: 'tread', x0: x, x1: x + T, y, flight: f });
				x += T;
			} else if (!last) {
				steps.push({ kind: 'landing', x0: x, x1: x + A, y, flight: f });
			} else {
				steps.push({ kind: 'top', x0: x, x1: x + Math.max(36, LD), y, flight: f });
			}
		}
		// The stringer sits on the rough floor, or on the landing framing
		// (under tread stock); its first rise makes the first tread right.
		const seat = f === 0 ? 0 : y0 - tt;
		const firstRise = y0 + R - tt - seat;
		const rough = k * R;
		const length = Math.hypot(k * T, rough);
		flights.push({ risers: k, treads: k - 1, x0, x1: x, y0, y1: y, rise: y - y0, run: x - x0, seat, firstRise, length, stock: stock(length), width: w, stringers: stringersFor(w), o, d });
		if (last || !src) return;

		// The landing, in the frame of the arriving flight's left edge at
		// its last riser: along (on up) and across (to the right).
		const e = toPlan(o, d, x - x0, 0);
		const sr = rightOf(d);
		const W1 = w;
		const W2 = above;
		const G = turn === 'u-left' || turn === 'u-right' ? (src.gap ?? 0) : 0;
		let B = 0;
		let next = 0;
		let rects: Rect[];
		let no: V2;
		let nd: V2;
		if (turn === 'right' || turn === 'left') {
			next = Math.max(0, src.next ?? need(W2) - W1);
			B = W1 + next;
			const c0 = turn === 'right' ? 0 : W1 - B;
			rects = [{ a0: 0, a1: A, c0, c1: c0 + B }];
			nd = turn === 'right' ? sr : back(sr);
			no = turn === 'right' ? toPlan(e, d, A, B) : toPlan(e, d, A - W2, W1 - B);
		} else if (turn === 'u-right' || turn === 'u-left') {
			next = Math.max(12 - A, src.next ?? 0);
			B = A + next;
			const sgn = turn === 'u-right' ? 1 : -1;
			// The gap and the flight above lie off the turning side.
			const [g0, g1] = sgn > 0 ? [W1, W1 + G] : [-G, 0];
			const [d0, d1] = sgn > 0 ? [W1 + G, W1 + G + W2] : [-G - W2, -G];
			rects = [{ a0: 0, a1: A, c0: 0, c1: W1 }, { a0: A - B, a1: A, c0: d0, c1: d1 }];
			if (G > EPS) rects.push({ a0: Math.max(0, A - B), a1: A, c0: g0, c1: g1 });
			nd = back(d);
			no = toPlan(e, d, A - B, sgn > 0 ? W1 + G + W2 : -G);
		} else {
			B = A;
			rects = [{ a0: 0, a1: A, c0: 0, c1: Math.max(W1, W2) }];
			nd = d;
			no = toPlan(e, d, A, 0);
		}
		const a0 = Math.min(...rects.map((r) => r.a0));
		const a1 = Math.max(...rects.map((r) => r.a1));
		const c0 = Math.min(...rects.map((r) => r.c0));
		const c1 = Math.max(...rects.map((r) => r.c1));
		const nt = src.notch;
		const holes: Rect[] = [];
		if (nt) {
			const far = nt.corner.startsWith('far');
			const right = nt.corner.endsWith('right');
			const na = Math.min(nt.along, a1 - a0);
			const nc = Math.min(nt.across, c1 - c0);
			holes.push({ a0: far ? a1 - na : a0, a1: far ? a1 : a0 + na, c0: right ? c1 - nc : c0, c1: right ? c1 : c0 + nc });
		}
		const outline = cells(rects.map((r) => rectToPlan(e, d, r)), holes.map((r) => rectToPlan(e, d, r))).loops;
		lands.push({ ...src, src, turn, at: 0, depth: A, before: B, past, next, gap: G, width: src.width ?? null, below: W1, above: W2, x0: x, x1: x + A, o: e, d, rects, holes, outline, size: [a1 - a0, c1 - c0] });
		x += A;
		o = no;
		d = nd;
		w = W2;
	});
	const run = steps.find((st) => st.kind === 'top')!.x0;

	// Headroom: the sloped line through the nosings (flat over landings)
	// must stay this far below the upper floor framing.
	const ceiling = rise - pos(s.floorDepth);
	const target = ceiling - L.headroom;
	const line: [number, number][] = [[0, fb]];
	for (const st of steps) {
		line.push([st.x0, st.y]);
		if (st.kind === 'landing') line.push([st.x1, st.y]);
	}
	let openingAt = run;
	for (let i = 1; i < line.length; i++) {
		const [ax, ay] = line[i - 1];
		const [bx, by] = line[i];
		if (by > target + EPS) {
			openingAt = ay >= target ? ax : ax + ((target - ay) / (by - ay)) * (bx - ax);
			break;
		}
	}
	const opening = Math.max(0, run - openingAt);

	const spots: Landing[] = lands.map((p, i) => {
		const f = flights[i];
		return { ...p, at: per.slice(0, i + 1).reduce((a, b) => a + b, 0), height: f.y1 - fb, framing: f.y1 - tt };
	});

	// In plan: the floor past the top riser, all the stair covers, and the
	// opening: wherever the nosing line (or a landing) comes within the
	// headroom of the upper floor framing.
	const lf = flights[flights.length - 1];
	const topFloor = rectToPlan(lf.o, lf.d, { a0: lf.run, a1: lf.run + 36, c0: 0, c1: lf.width });
	const parts: Rect[] = flights.map((f) => rectToPlan(f.o, f.d, { a0: 0, a1: f.run, c0: 0, c1: f.width }));
	for (const p of spots) for (const q of p.rects) parts.push(rectToPlan(p.o, p.d, q));
	const bounds: Rect = {
		a0: Math.min(...parts.map((q) => q.a0)),
		a1: Math.max(...parts.map((q) => q.a1)),
		c0: Math.min(...parts.map((q) => q.c0)),
		c1: Math.max(...parts.map((q) => q.c1))
	};
	const open: Rect[] = [];
	for (const f of flights) {
		const a = Math.max(0, ((target - f.y0 - R) * T) / R);
		if (a < f.run - EPS) open.push(rectToPlan(f.o, f.d, { a0: a, a1: f.run, c0: 0, c1: f.width }));
	}
	for (const p of spots) if (p.height + fb > target + EPS) for (const q of p.rects) open.push(rectToPlan(p.o, p.d, q));
	const oc = open.length ? cells(open) : { boxes: [], loops: [] };
	const span = (lo: (q: Rect) => number, hi: (q: Rect) => number) => Math.max(...open.map(hi)) - Math.min(...open.map(lo));
	const openingPlan = { ...oc, size: (open.length ? [span((q) => q.a0, (q) => q.a1), span((q) => q.c0, (q) => q.c1)] : [0, 0]) as [number, number] };

	const notch = (R * T) / Math.hypot(R, T);
	const throat = STRINGER_DEPTH[s.stringer] - notch;
	const treads = n - flightsN;
	const comfort = 2 * R + T;

	const warnings: string[] = [];
	const hints: string[] = [];
	const f16 = (v: number) => formatFtIn(v, 16, v < 60);
	if (R > L.maxRiser + EPS) warnings.push(`Risers are ${f16(R)}: over the ${f16(L.maxRiser)} ${L.name} limit. Add a riser.`);
	if (L.minRiser && R < L.minRiser - EPS) warnings.push(`Risers are ${f16(R)}: under the ${f16(L.minRiser)} minimum. Take one out.`);
	if (T < L.minTread - EPS) warnings.push(`Tread run under the ${f16(L.minTread)} minimum.`);
	if (L.nosingUnder && T < L.nosingUnder - EPS && (s.nosing < L.nosing[0] - EPS || s.nosing > L.nosing[1] + EPS))
		warnings.push(`With a run under ${f16(L.nosingUnder)}, the nosing must be ${f16(L.nosing[0])} to ${f16(L.nosing[1])}.`);
	else if (s.nosing > L.nosing[1] + EPS) warnings.push(`Nosing over ${f16(L.nosing[1])}.`);
	if (flights.some((f) => f.width < L.minWidth - EPS)) warnings.push(`Narrower than the ${f16(L.minWidth)} minimum width.`);
	const tallest = Math.max(...flights.map((f) => f.risers * R));
	if (tallest > L.maxFlightRise + EPS) warnings.push(`A flight climbs ${f16(tallest)}: over ${f16(L.maxFlightRise)} needs a landing.`);
	lands.forEach((p, i) => {
		const short = p.depth < need(p.below) - EPS || (p.turn !== 'straight' && p.before < need(p.above) - EPS);
		if (short) warnings.push(`Landing ${i + 1} must be at least ${f16(Math.min(need(p.below), need(p.above)))} deep${p.turn === 'straight' ? '' : ' each way you walk onto it'}.`);
	});
	if (throat < 3.5) warnings.push(`Only ${f16(throat)} of stringer left under the notches: use a deeper stringer.`);
	else if (throat < 5) hints.push(`${f16(throat)} of stringer under the notches; 5″ or more is better.`);
	if (comfort < 24 - EPS || comfort > 25.5 + EPS) hints.push(`2 risers + 1 tread = ${f16(comfort)}; 24″ to 25″ walks easiest.`);
	if (s.risers !== null && n !== autoRisers) hints.push(`${autoRisers} risers is the fewest the code allows.`);

	return {
		finishedRise,
		risers: n,
		riser: R,
		treads,
		run,
		angle: (Math.atan2(R, T) * 180) / Math.PI,
		flights,
		steps,
		landings: flightsN - 1,
		spots,
		custom: !!custom,
		turns: spots.some((p) => p.turn !== 'straight'),
		topFloor,
		bounds,
		openingPlan,
		ceiling,
		opening,
		openingAt,
		notch,
		throat,
		stringers: flights[0].stringers,
		topDrop: R + tt - ftp,
		treadDepth: T + s.nosing + pos(s.riserThk),
		riserBoard: Math.max(0, R - tt),
		comfort,
		warnings,
		hints,
		limits: L
	};
}

/** The straight runs of a stair: flights from..to between turns. */
export function stairRuns(r: StairResult): [number, number][] {
	const out: [number, number][] = [];
	let from = 0;
	r.spots.forEach((p, i) => {
		if (p.turn === 'straight') return;
		out.push([from, i]);
		from = i + 1;
	});
	out.push([from, r.flights.length - 1]);
	return out;
}

export interface StairCut {
	what: string;
	size: string;
	count: number;
}

/** What to cut: stringers per flight, treads, risers, landing platforms. */
export function stairCuts(s: StairInput, r: StairResult, ft: (v: number) => string): StairCut[] {
	const out: StairCut[] = [];
	const byStock = new Map<number, number>();
	for (const f of r.flights) if (f.risers > 1) byStock.set(f.stock, (byStock.get(f.stock) ?? 0) + f.stringers);
	for (const [len, n] of byStock) out.push({ what: 'Stringers', size: `${s.stringer} × ${Math.round(len / 12)}′`, count: n });
	const tally = (m: Map<string, number>, k: string, n: number) => n > 0 && m.set(k, (m.get(k) ?? 0) + n);
	const treads = new Map<string, number>();
	const risers = new Map<string, number>();
	for (const f of r.flights) {
		tally(treads, `${ft(f.width)} × ${ft(r.treadDepth)} × ${ft(s.treadThk)}`, f.treads);
		tally(risers, `${ft(f.width)} × ${ft(r.riserBoard)} × ${ft(s.riserThk)}`, f.risers);
	}
	for (const [k, n] of treads) out.push({ what: 'Treads', size: k, count: n });
	if (s.riserThk > 0) for (const [k, n] of risers) out.push({ what: 'Risers', size: k, count: n });
	const lands = new Map<string, number>();
	for (const p of r.spots) tally(lands, `${ft(p.size[0])} × ${ft(p.size[1])}${p.rects.length > 1 || p.holes.length ? ', shaped' : ''}`, 1);
	for (const [k, n] of lands) out.push({ what: 'Landing platforms', size: k, count: n });
	return out;
}

/** The code reminders under the stair: the limits of the chosen code. */
export function codeNotes(L: CodeLimits, ft: (v: number) => string): string[] {
	const out = [
		`Risers ${L.minRiser ? `${ft(L.minRiser)} to ` : 'at most '}${ft(L.maxRiser)}; treads at least ${ft(L.minTread)}, nosing to nosing.`,
		`In a flight, the tallest riser and the deepest tread may differ from the smallest by at most ${ft(L.variation)}.`,
		L.nosingUnder
			? `Nosing ${ft(L.nosing[0])} to ${ft(L.nosing[1])} when the tread is under ${ft(L.nosingUnder)}; none needed with solid risers and 11″ treads.`
			: `Nosing at most ${ft(L.nosing[1])}, the same on every step.`,
		`Width at least ${ft(L.minWidth)}${L.minWidth > 36 ? ` (36″ with an occupant load under 50)` : ''}; headroom ${ft(L.headroom)}, measured plumb from the nosing line.`,
		`A flight may climb at most ${ft(L.maxFlightRise)}; a landing at the top and bottom of every flight, ${
			L.landingByWidth ? `as deep as the stair is wide (${ft(L.minLanding)} is enough)` : `at least ${ft(L.minLanding)} deep and as wide as the stair`
		}.`,
		L.landingByWidth
			? `Handrails on both sides, ${ft(L.handrail[0])} to ${ft(L.handrail[1])} above the nosings; guards ${ft(L.guard)} high where the drop is over 30″.`
			: `Handrail ${ft(L.handrail[0])} to ${ft(L.handrail[1])} above the nosings with ${L.handrailAt} or more risers; guards ${ft(L.guard)} high where the drop is over 30″ (34″ along the stair, from the nosings).`,
		`Open risers and guard openings must stop a ${ft(L.sphere)} sphere.`,
		`Check your local code: amendments change these.`
	];
	return out;
}
