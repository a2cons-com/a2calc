// A wood stud wall, member by member, as straight runs.
//
// - Studs on layout from each run's start, an end stud at each end (so a
//   corner gets two, plus one backer per corner).
// - Top plates (double by default) all along; bottom plates cut out at
//   doors. Plates come in stock lengths, butt-jointed.
// - At each door or window: king and jack studs each side, a header on
//   the jacks (plies to fill the wall's width), cripples above it on the
//   layout; under a window a sill and cripples below it.
//
// Every member gets a position along its run, so the drawing and the
// counts come from the same list.

export const LUMBER: Record<string, [number, number]> = {
	'2x4': [1.5, 3.5],
	'2x6': [1.5, 5.5],
	'2x8': [1.5, 7.25],
	'2x10': [1.5, 9.25],
	'2x12': [1.5, 11.25]
};
export const STUD_SIZES = ['2x4', '2x6', '2x8'] as const;
export const HEADER_SIZES = ['2x6', '2x8', '2x10', '2x12'] as const;
export const SPACINGS = [12, 16, 19.2, 24] as const;
export const STANDARD_FT = [8, 10, 12, 14, 16, 18, 20];
/** Precut studs (inches) and the wall height each makes with 3 plates. */
export const PRECUTS = [92.625, 104.625, 116.625];

export type Role = 'stud' | 'corner' | 'king' | 'jack' | 'cripple' | 'header' | 'sill' | 'top plate' | 'bottom plate';

export interface Opening {
	id: number;
	kind: 'door' | 'window';
	/** Rough opening width, inches. */
	width: number;
	/** Rough opening height, inches. */
	height: number;
	/** Window: floor to the bottom of the rough opening, inches. */
	sill: number;
	/** From the run's start to the opening's left edge; null = centered. */
	offset: number | null;
	header: string;
}

export interface Run {
	id: number;
	length: number;
	openings: Opening[];
}

export interface WallInput {
	member: string;
	spacing: number;
	/** Floor to top of the top plate, inches. */
	height: number;
	topPlates: number;
	bottomPlates: number;
	/** Longest plate stock, inches. */
	stock: number;
	runs: Run[];
	/** The runs close back on the first (a room): one more corner. */
	closed: boolean;
	wastePct: number;
}

export interface Member {
	role: Role;
	size: string;
	/** Cut length, inches (1/8" rounded). */
	length: number;
	/** Drawing box in the run's elevation: left, bottom, width, height (in). */
	x: number;
	y: number;
	w: number;
	h: number;
	/** A header is one member per ply, drawn once: the first ply carries
	 *  the ply count, the others 0 (skip them when drawing). */
	plies: number;
}

export interface RunFraming {
	run: Run;
	members: Member[];
	/** Openings placed: left/right edges and head (inches). */
	placed: { o: Opening; a: number; b: number; head: number }[];
}

export interface CutLine {
	role: Role;
	size: string;
	length: number;
	count: number;
}

export interface BuyLine {
	size: string;
	/** Stock length, feet, or a precut stud length in inches. */
	feet: number;
	precut: number | null;
	count: number;
}

export interface WallResult {
	runs: RunFraming[];
	corners: number;
	studLength: number;
	cuts: CutLine[];
	buy: BuyLine[];
	/** Plate lineal feet (top + bottom). */
	plateLf: number;
	warnings: string[];
}

const r8 = (x: number) => Math.round(x * 8) / 8;

/** Stud centers along a run: one at each end, the rest every `spacing`
 *  from the start; a layout stud too close to the end one is left out. */
export function layout(length: number, spacing: number, t: number): number[] {
	if (length < 2 * t) return [length / 2];
	const end = length - t / 2;
	const spots = [t / 2];
	for (let k = 1; k * spacing < end - t + 1e-9; k++) spots.push(k * spacing);
	spots.push(end);
	return spots;
}

export function splitRun(length: number, stock: number): number[] {
	if (length <= stock + 1e-9) return [length];
	const n = Math.ceil(length / stock - 1e-9);
	return [...Array(n - 1).fill(stock), length - stock * (n - 1)];
}

/** Openings placed along a run: centered unless an offset is given,
 *  kept inside the run. */
export function place(run: Run, wallHeight: number) {
	return run.openings.map((o) => {
		const width = Math.max(0, Math.min(o.width, run.length));
		const a = Math.max(0, Math.min(run.length - width, o.offset ?? (run.length - width) / 2));
		const sill = o.kind === 'door' ? 0 : Math.max(0, o.sill);
		const head = Math.min(wallHeight, sill + Math.max(0, o.height));
		return { o, a, b: a + width, head, sill };
	});
}

export function frameWall(w: WallInput): WallResult {
	const size = w.member;
	const [t, depth] = LUMBER[size] ?? LUMBER['2x4'];
	const tp = Math.max(0, Math.floor(w.topPlates));
	const bp = Math.max(0, Math.floor(w.bottomPlates));
	const H = Math.max(0, w.height);
	const stud = r8(H - (tp + bp) * t);
	const warnings: string[] = [];
	const corners = Math.max(0, w.runs.length - 1 + (w.closed && w.runs.length > 1 ? 1 : 0));
	const runs: RunFraming[] = [];
	if (stud <= 0) return { runs: [], corners, studLength: 0, cuts: [], buy: [], plateLf: 0, warnings: ['The wall is shorter than its plates.'] };

	const king = 1;
	const jack = 1;
	for (const run of w.runs) {
		const L = Math.max(0, run.length);
		const members: Member[] = [];
		const vert = (role: Role, cx: number, y: number, len: number) =>
			len > 0.01 && members.push({ role, size, length: r8(len), x: cx - t / 2, y, w: t, h: len, plies: 1 });
		const placed = place(run, H);
		const ops = placed.map((p) => ({ ...p, lo: p.a - (king + jack) * t, hi: p.b + (king + jack) * t, cripples: [] as number[] }));
		for (let i = 0; i < ops.length; i++)
			for (let j = i + 1; j < ops.length; j++)
				if (ops[i].lo < ops[j].hi && ops[j].lo < ops[i].hi) warnings.push(`Openings overlap on wall ${w.runs.indexOf(run) + 1}: move one.`);
		for (const p of ops) if (p.lo < -1e-6 || p.hi > L + 1e-6) warnings.push(`An opening on wall ${w.runs.indexOf(run) + 1} is too close to the end for its king and jack studs.`);

		// Studs on layout; those landing on an opening become cripples.
		for (const cx of layout(L, w.spacing, t)) {
			const hit = ops.find((o) => cx + t / 2 > o.lo + 1e-6 && cx - t / 2 < o.hi - 1e-6);
			if (!hit) vert('stud', cx, bp * t, stud);
			else if (cx - t / 2 >= hit.a - 1e-6 && cx + t / 2 <= hit.b + 1e-6) hit.cripples.push(cx);
		}
		// Plates.
		for (let k = 0; k < tp; k++) {
			let x = 0;
			for (const piece of splitRun(L, w.stock)) {
				members.push({ role: 'top plate', size, length: r8(piece), x, y: H - (k + 1) * t, w: piece, h: t, plies: 1 });
				x += piece;
			}
		}
		const doors = ops.filter((o) => o.sill === 0).map((o) => [o.a, o.b] as const).sort((p, q) => p[0] - q[0]);
		const bottomRuns: [number, number][] = [];
		let at = 0;
		for (const [a, b] of doors) {
			bottomRuns.push([at, a - at]);
			at = Math.max(at, b);
		}
		bottomRuns.push([at, L - at]);
		for (let k = 0; k < bp; k++)
			for (const [x0, len] of bottomRuns) {
				if (len <= 0.25) continue;
				let x = x0;
				for (const piece of splitRun(len, w.stock)) {
					members.push({ role: 'bottom plate', size, length: r8(piece), x, y: k * t, w: piece, h: t, plies: 1 });
					x += piece;
				}
			}
		// Openings.
		for (const o of ops) {
			const width = o.b - o.a;
			for (let k = 0; k < king; k++) {
				vert('king', o.a - t / 2 - (jack + k) * t, bp * t, stud);
				vert('king', o.b + t / 2 + (jack + k) * t, bp * t, stud);
			}
			const top = H - tp * t;
			const hasHeader = o.head < top - 1e-6;
			for (let k = 0; k < jack; k++) {
				const len = (hasHeader ? o.head : top) - bp * t;
				vert('jack', o.a - t / 2 - k * t, bp * t, len);
				vert('jack', o.b + t / 2 + k * t, bp * t, len);
			}
			if (hasHeader) {
				const hsize = LUMBER[o.o.header] ? o.o.header : '2x10';
				const [ht, hd] = LUMBER[hsize];
				const plies = Math.max(1, Math.floor(depth / ht + 1e-9));
				const hlen = width + 2 * jack * t;
				for (let k = 0; k < plies; k++)
					members.push({ role: 'header', size: hsize, length: r8(hlen), x: o.a - jack * t, y: o.head, w: hlen, h: Math.min(hd, top - o.head), plies: k === 0 ? plies : 0 });
				const room = top - (o.head + hd);
				if (room < -1e-6) warnings.push(`A ${o.o.kind} header (${hsize}) runs into the top plate on wall ${w.runs.indexOf(run) + 1}: lower the opening or pick a shallower header.`);
				else for (const cx of o.cripples) vert('cripple', cx, o.head + hd, room);
			}
			if (o.o.kind === 'window' && o.sill > bp * t + t) {
				members.push({ role: 'sill', size, length: r8(width), x: o.a, y: o.sill - t, w: width, h: t, plies: 1 });
				for (const cx of o.cripples) vert('cripple', cx, bp * t, o.sill - t - bp * t);
			}
		}
		runs.push({ run, members, placed: ops.map(({ o, a, b, head }) => ({ o, a, b, head })) });
	}

	// Corner backers: drawn on the run they start (at its left end).
	const corner: Member[] = Array.from({ length: corners }, () => ({ role: 'corner' as Role, size, length: stud, x: 0, y: bp * t, w: t, h: stud, plies: 1 }));
	const counted = [...runs.flatMap((r) => r.members), ...corner];

	const cutMap = new Map<string, CutLine>();
	for (const m of counted) {
		const k = `${m.role}|${m.size}|${m.length}`;
		const line = cutMap.get(k) ?? { role: m.role, size: m.size, length: m.length, count: 0 };
		line.count++;
		cutMap.set(k, line);
	}
	const ORDER: Role[] = ['stud', 'corner', 'king', 'jack', 'cripple', 'header', 'sill', 'top plate', 'bottom plate'];
	const cuts = [...cutMap.values()].sort((p, q) => ORDER.indexOf(p.role) - ORDER.indexOf(q.role) || q.length - p.length);

	return { runs, corners, studLength: stud, cuts, buy: buyList(counted, stud, w.stock, w.wastePct), plateLf: counted.filter((m) => m.role.endsWith('plate')).reduce((s, m) => s + m.length, 0) / 12, warnings: [...new Set(warnings)] };
}

/** What to buy: full-height studs one per piece (a precut when one fits
 *  exactly); everything else packed first-fit, longest first, into the
 *  stock length, each board bought at the shortest standard length that
 *  holds what was cut from it. Waste is added on top, rounded up. */
export function buyList(members: Member[], stud: number, stock: number, wastePct: number): BuyLine[] {
	const lines = new Map<string, BuyLine>();
	const add = (size: string, feet: number, precut: number | null, n = 1) => {
		const k = `${size}|${feet}|${precut}`;
		const l = lines.get(k) ?? { size, feet, precut, count: 0 };
		l.count += n;
		lines.set(k, l);
	};
	const full = members.filter((m) => m.role === 'stud' || m.role === 'corner' || m.role === 'king');
	const precut = PRECUTS.find((p) => Math.abs(p - stud) < 1 / 16) ?? null;
	const studFeet = STANDARD_FT.find((f) => f * 12 >= stud - 1e-6) ?? Math.ceil(stud / 12);
	for (const m of full) add(m.size, precut ? 0 : studFeet, precut);
	const rest = members.filter((m) => !full.includes(m) && m.role !== 'corner');
	const bySize = new Map<string, number[]>();
	for (const m of rest) bySize.set(m.size, [...(bySize.get(m.size) ?? []), m.length]);
	const cap = Math.max(stock, ...STANDARD_FT.map((f) => f * 12).filter((x) => x <= stock));
	for (const [size, pieces] of bySize) {
		const bins: number[] = [];
		for (const p of [...pieces].sort((a, b) => b - a)) {
			const kerf = 0.125;
			const i = bins.findIndex((used) => used + kerf + p <= cap + 1e-6);
			if (i >= 0) bins[i] += kerf + p;
			else bins.push(p);
		}
		for (const used of bins) add(size, STANDARD_FT.find((f) => f * 12 >= used - 1e-6) ?? Math.ceil(used / 12), null);
	}
	const extra = Math.max(0, wastePct) / 100;
	return [...lines.values()]
		.map((l) => ({ ...l, count: Math.ceil(l.count * (1 + extra) - 1e-9) }))
		.sort((p, q) => p.size.localeCompare(q.size, 'en', { numeric: true }) || (q.precut ?? 0) - (p.precut ?? 0) || q.feet - p.feet);
}

/** Clear wall between rough openings, and from an opening to a wall end
 *  (room for the king, jack and end stud), inches. */
export const OPENING_GAP = 12;
export const END_GAP = 6;

/** Where a new opening of `width` goes on a run: centered in the largest
 *  free stretch, a foot clear of other openings and 6″ from the ends. When
 *  nothing fits, the run is lengthened and the opening goes past the last
 *  one. Returns the offset of its left edge and the run's length. */
export function freeSpot(run: Run, width: number, wallHeight: number): { offset: number; length: number } {
	const taken = place(run, wallHeight)
		.map((p) => [p.a, p.b] as const)
		.sort((x, y) => x[0] - y[0]);
	let best: { from: number; to: number } | null = null;
	let from = END_GAP;
	for (const [a, b] of taken) {
		const to = a - OPENING_GAP;
		if (to - from >= width && (!best || to - from > best.to - best.from)) best = { from, to };
		from = Math.max(from, b + OPENING_GAP);
	}
	const end = run.length - END_GAP;
	if (end - from >= width && (!best || end - from > best.to - best.from)) best = { from, to: end };
	if (best) return { offset: Math.round(best.from + (best.to - best.from - width) / 2), length: run.length };
	const last = taken.length ? taken[taken.length - 1][1] + OPENING_GAP : END_GAP;
	return { offset: last, length: Math.ceil(last + width + END_GAP) };
}

/** How far an opening may move: between its neighbours (a foot clear) and
 *  the wall ends (6″ clear). Returns [min, max] for its left edge. */
export function moveRange(run: Run, id: number, wallHeight: number): [number, number] {
	const placed = place(run, wallHeight);
	const me = placed.find((p) => p.o.id === id);
	if (!me) return [0, 0];
	const width = me.b - me.a;
	let lo = END_GAP;
	let hi = run.length - END_GAP - width;
	for (const p of placed) {
		if (p.o.id === id) continue;
		if (p.a + p.b <= me.a + me.b) lo = Math.max(lo, p.b + OPENING_GAP);
		else hi = Math.min(hi, p.a - OPENING_GAP - width);
	}
	return hi >= lo ? [lo, hi] : [Math.max(0, Math.min(me.a, run.length - width)), Math.max(0, Math.min(me.a, run.length - width))];
}
