// Wall tile, one wall at a time: the tiled stretch of a wall (from the
// floor, or from the top of a tub or shower base, up to a height), less its
// windows, niches and doors, laid out piece by piece with the floor's
// engine (see flooring.ts) from a level line and a plumb line.
//
// The wall is drawn as seen from the room: x along it from its left end,
// heights up from the floor. The engine works in "plan" inches with y down,
// so the tiled stretch runs y 0 (its top) to its height (its bottom), and
// its four sides are the top (1), the right end (2), the bottom (3) and the
// left end (4).

import { flooring, type FloorInput, type FloorResult, type LineRef, type PatternId, type V2 } from './flooring';

export type OpeningKind = 'window' | 'niche' | 'door';
export interface WallOpening {
	id: number;
	kind: OpeningKind;
	/** From the wall's left end to the opening's left side. */
	x: number;
	/** Bottom above the floor (0 for a door). */
	sill: number;
	w: number;
	h: number;
	/** Niche depth, or a window's return depth (0: returns not tiled). */
	depth: number;
}
export type EndKind = 'corner' | 'edge';
export interface WallTileInput {
	/** The wall, end to end, and floor to ceiling (for the drawing). */
	length: number;
	ceiling: number;
	/** Where the tile starts: the floor, or the top of a tub or shower base. */
	start: 'floor' | 'tub';
	tubHeight: number;
	/** Top of the tile, above the floor. */
	top: number;
	/** Each end: into an inside corner (caulked) or an exposed edge (trimmed). */
	left: EndKind;
	right: EndKind;
	/** Trim along the top of the tile. */
	trimTop: boolean;
	/** Trim piece length. */
	trimLen: number;
	openings: WallOpening[];
	pattern: PatternId;
	tileW: number;
	tileL: number;
	small: number;
	offset: number;
	turned: boolean;
	joint: number;
	/** Left at the floor or tub, the corners and around openings. */
	gap: number;
	/** The level line (along the wall) and the plumb line. */
	lineA: LineRef;
	lineB: LineRef;
	onLine: 'joint' | 'center';
	extraPct: number;
	boxSqft: number;
	box2Sqft: number;
	sheet: boolean;
	sheetSqft: number;
	thick: number;
	/** Backer board sheet, sq ft; 0 for none. */
	backerSqft: number;
	/** Sections: plumb cuts, inches from the left end. */
	cuts: { id: number; x: number }[];
}

export const SIDE_NAME = ['Top', 'Right end', 'Bottom', 'Left end'];

export interface WallTileResult {
	f: FloorResult;
	/** The tiled stretch: bottom and top above the floor. */
	y0: number;
	y1: number;
	/** Plan y of a height above the floor, and back. */
	toY: (h: number) => number;
	/** Niche backs and sides, tiled window returns, sq in: ordered by area. */
	extraArea: number;
	extraPcs: number;
	/** Trim, linear feet, and pieces (+10%). */
	trimLf: number;
	trimPcs: number;
	backer: number;
	/** Openings clipped to the tiled stretch (plan boxes, without the gap). */
	holes: { id: number; kind: OpeningKind; x0: number; x1: number; y0: number; y1: number }[];
	warnings: string[];
}

/** The floor engine's input for a wall. */
export function wallFloorInput(s: WallTileInput): FloorInput {
	const y0 = s.start === 'tub' ? Math.max(0, s.tubHeight) : 0;
	const H = Math.max(1, s.top - y0);
	const L = Math.max(1, s.length);
	const toY = (h: number) => s.top - h;
	const g = Math.max(0, s.gap);
	const holes = s.openings.map((o) => ({ x0: o.x - g, x1: o.x + o.w + g, y0: toY(o.sill + o.h) - g, y1: toY(o.sill) + g }));
	const marks = s.openings.map((o) => ({ id: o.id, c: [o.x + o.w / 2, toY(o.sill + o.h / 2)] as V2 }));
	return {
		material: 'tile',
		rect: true,
		sides: [
			{ id: 1, length: L, turn: 'right', doors: [] },
			{ id: 2, length: H, turn: 'right', doors: [] },
			{ id: 3, length: L, turn: 'right', doors: [] },
			{ id: 4, length: H, turn: 'right', doors: [] }
		],
		pattern: s.pattern,
		tileW: s.tileW,
		tileL: s.tileL,
		small: s.small,
		offset: s.offset,
		turned: s.turned,
		joint: s.joint,
		gap: g,
		along: 2,
		lineA: s.lineA,
		lineB: s.lineB,
		onLine: s.onLine,
		extraPct: s.extraPct,
		boxSqft: s.boxSqft,
		box2Sqft: s.box2Sqft,
		sheet: s.sheet,
		sheetSqft: s.sheetSqft,
		thick: s.thick,
		rollSqft: 0,
		base: false,
		cuts: [],
		holes,
		marks
	};
}

export function wallTile(s: WallTileInput): WallTileResult {
	const warnings: string[] = [];
	const y0 = s.start === 'tub' ? Math.max(0, s.tubHeight) : 0;
	const y1 = s.top;
	if (y1 <= y0 + 1) warnings.push('The tile stops below where it starts: raise its top.');
	if (s.top > s.ceiling) warnings.push('The tile runs above the ceiling.');
	const fi = wallFloorInput(s);
	const f = flooring(fi);
	const toY = (h: number) => s.top - h;
	const H = Math.max(1, y1 - y0);
	const L = Math.max(1, s.length);
	const holes = s.openings
		.map((o) => ({ id: o.id, kind: o.kind, x0: Math.max(0, o.x), x1: Math.min(L, o.x + o.w), y0: Math.max(0, toY(o.sill + o.h)), y1: Math.min(H, toY(o.sill)) }))
		.filter((h) => h.x1 > h.x0 && h.y1 > h.y0);
	for (const o of s.openings) {
		if (o.x < 0 || o.x + o.w > L) warnings.push(`${o.kind === 'door' ? 'A door' : o.kind === 'niche' ? 'A niche' : 'A window'} runs past the end of the wall.`);
	}

	// Niche backs and sides and tiled window returns, by area.
	let extraArea = 0;
	for (const h of holes) {
		const o = s.openings.find((x) => x.id === h.id)!;
		const w = h.x1 - h.x0;
		const hh = h.y1 - h.y0;
		if (o.kind === 'niche') extraArea += w * hh + 2 * (w + hh) * Math.max(0, o.depth);
		else if (o.kind === 'window' && o.depth > 0) extraArea += 2 * (w + hh) * o.depth;
	}
	const t0 = f.types[0];
	const extraPcs = extraArea > 0 && t0 ? Math.ceil(((extraArea / Math.max(1, t0.area)) * (1 + Math.max(0, s.extraPct) / 100)) - 1e-9) : 0;
	if (t0) {
		t0.order += extraPcs;
		t0.boxes = t0.boxSqft > 0 ? Math.ceil((t0.order * t0.area) / 144 / t0.boxSqft - 1e-9) : 0;
	}

	// Trim: the top, exposed ends, around windows and niches.
	let trim = 0;
	if (s.trimTop && y1 < s.ceiling - 0.5) trim += L;
	if (s.left === 'edge') trim += H;
	if (s.right === 'edge') trim += H;
	for (const h of holes) {
		const o = s.openings.find((x) => x.id === h.id)!;
		if (o.kind === 'door') continue;
		trim += 2 * (h.x1 - h.x0 + h.y1 - h.y0);
	}
	const trimLf = trim / 12;
	const trimPcs = trim > 0 && s.trimLen > 0 ? Math.ceil((trim * 1.1) / s.trimLen - 1e-9) : 0;
	const backer = s.backerSqft > 0 ? Math.ceil((((L * H) / 144) * 1.1) / s.backerSqft - 1e-9) : 0;
	if (s.start === 'tub' && s.gap < 1 / 8) warnings.push('Leave about 1/8″ over the tub or base and caulk it, not grout.');
	return { f, y0, y1, toY, extraArea, extraPcs, trimLf, trimPcs, backer, holes, warnings: [...f.warnings.filter((w) => !w.includes('sides miss')), ...warnings] };
}

