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

/** A landing placed by hand: `at` risers below it, `depth` along the run. */
export interface LandingSpot {
	at: number;
	depth: number;
}

/** Hand-placed landings made valid for `n` risers: in order, each at
 *  least a riser above the last, none at the floors. */
function normSpots(spots: LandingSpot[] | null | undefined, n: number): LandingSpot[] | null {
	if (!spots?.length || n < 2) return null;
	const list = [...spots].filter((p) => Number.isFinite(p.at)).sort((a, b) => a.at - b.at).slice(0, n - 1);
	if (!list.length) return null;
	let prev = 0;
	return list.map((p, i) => {
		const at = Math.min(n - (list.length - i), Math.max(prev + 1, Math.round(p.at)));
		prev = at;
		return { at, depth: Number.isFinite(p.depth) ? Math.max(12, p.depth) : 36 };
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
	spots: (LandingSpot & { height: number; framing: number; x0: number; x1: number })[];
	/** Landings placed by hand. */
	custom: boolean;
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
	const depthOf = (i: number) => (custom ? custom[i].depth : LD);

	const steps: Step[] = [];
	const flights: Flight[] = [];
	let x = 0;
	let y = fb;
	per.forEach((k, f) => {
		const x0 = x;
		const y0 = y;
		const last = f === flightsN - 1;
		for (let r = 1; r <= k; r++) {
			y += R;
			if (r < k) {
				steps.push({ kind: 'tread', x0: x, x1: x + T, y, flight: f });
				x += T;
			} else if (!last) {
				steps.push({ kind: 'landing', x0: x, x1: x + depthOf(f), y, flight: f });
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
		flights.push({ risers: k, treads: k - 1, x0, x1: x, y0, y1: y, rise: y - y0, run: x - x0, seat, firstRise, length, stock: stock(length) });
		if (!last) x += depthOf(f);
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

	const notch = (R * T) / Math.hypot(R, T);
	const throat = STRINGER_DEPTH[s.stringer] - notch;
	const W = pos(s.width, 12);
	const maxSpacing = stringerSpacing(tt);
	const stringers = Math.max(2, Math.ceil((W - 1.5) / maxSpacing - EPS) + 1);
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
	if (W < L.minWidth - EPS) warnings.push(`Narrower than the ${f16(L.minWidth)} minimum width.`);
	const tallest = Math.max(...flights.map((f) => f.risers * R));
	if (tallest > L.maxFlightRise + EPS) warnings.push(`A flight climbs ${f16(tallest)}: over ${f16(L.maxFlightRise)} needs a landing.`);
	const needLanding = L.landingByWidth ? Math.min(L.minLanding, W) : L.minLanding;
	if (flightsN > 1 && Array.from({ length: flightsN - 1 }, (_, i) => depthOf(i)).some((d) => d < needLanding - EPS)) warnings.push(`Landings must be at least ${f16(needLanding)} deep.`);
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
		spots: flights.slice(0, -1).map((f, i) => {
			const at = per.slice(0, i + 1).reduce((a, b) => a + b, 0);
			return { at, depth: depthOf(i), height: f.y1 - fb, framing: f.y1 - tt, x0: f.x1, x1: f.x1 + depthOf(i) };
		}),
		custom: !!custom,
		ceiling,
		opening,
		openingAt,
		notch,
		throat,
		stringers,
		topDrop: R + tt - ftp,
		treadDepth: T + s.nosing + pos(s.riserThk),
		riserBoard: Math.max(0, R - tt),
		comfort,
		warnings,
		hints,
		limits: L
	};
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
	for (const f of r.flights) if (f.risers > 1) byStock.set(f.stock, (byStock.get(f.stock) ?? 0) + r.stringers);
	for (const [len, n] of byStock) out.push({ what: 'Stringers', size: `${s.stringer} × ${Math.round(len / 12)}′`, count: n });
	if (r.treads) out.push({ what: 'Treads', size: `${ft(s.width)} × ${ft(r.treadDepth)} × ${ft(s.treadThk)}`, count: r.treads });
	if (s.riserThk > 0) out.push({ what: 'Risers', size: `${ft(s.width)} × ${ft(r.riserBoard)} × ${ft(s.riserThk)}`, count: r.risers });
	const byDepth = new Map<number, number>();
	for (const p of r.spots) byDepth.set(p.depth, (byDepth.get(p.depth) ?? 0) + 1);
	for (const [d, n] of byDepth) out.push({ what: 'Landing platforms', size: `${ft(d)} × ${ft(s.width)}`, count: n });
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
