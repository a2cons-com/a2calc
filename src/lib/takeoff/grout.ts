// Grout to fill a hollow CMU wall.
//
// Based on Table 3 of TEK 4-2A, "Estimating Concrete Masonry Materials"
// (Concrete Masonry & Hardscapes Association): ft³ of grout
// per 100 ft² of hollow single-wythe wall by width, for two-core units,
// 3% waste included. Industry estimating guidance, not a standard. Its column is proportional to cells grouted,
// so the solid (every cell) figure gives grout per cell per foot of
// height, and partial grouting is counted cell by cell: cells at the
// spacing plus extra ones at corners, ends and jambs. Rebar is ignored
// (under 1% of a cell for a #5). https://www.cmha.org/resource/tek-04-02a/

import { FT3_PER_YD3, roundUpQuarter } from './concrete';
import { place, type Run } from './framing';

export const CMU_WIDTHS = [6, 8, 10, 12] as const;
export type CmuWidth = (typeof CMU_WIDTHS)[number];

/** TEK 4-2A Table 3, every cell grouted: ft³ per 100 ft², 3% waste in. */
export const SOLID_FT3_PER_100SF: Record<CmuWidth, number> = { 6: 25.6, 8: 36.1, 10: 47.0, 12: 58.9 };
export const TABLE_WASTE = 0.03;
/** One course: 7-5/8" unit + 3/8" joint. A unit is 16" long, two cells. */
export const COURSE_IN = 8;
export const UNIT_IN = 16;

export const cellFt3PerFt = (w: CmuWidth) => SOLID_FT3_PER_100SF[w] / 100 / 1.5 / (1 + TABLE_WASTE);

export interface GroutInput {
	width: CmuWidth;
	/** Total wall length, inches. */
	lengthIn: number;
	/** Lengths taken along the outside face: each corner then counts one
	 *  wall width twice, so it is taken off. */
	outside: boolean;
	heightIn: number;
	/** 0 = solid (every cell); else grouted cells every this many inches. */
	spacingIn: number;
	corners: number;
	/** Wall ends, door and window jambs: one grouted cell each. */
	ends: number;
	/** Grouted cells at each corner (partial grouting). */
	cellsPerCorner: number;
	/** Openings, sq ft (solid grouting only). */
	openingsSf: number;
	wastePct: number;
	/** Left in the pump and hose, yd³ (0 when bucketed). */
	pumpYd3: number;
	/** The walls, when drawn one by one (the app always does): their
	 *  totals replace lengthIn, corners, ends and openingsSf (wallTotals). */
	runs?: Run[];
	closed?: boolean;
	/** Lintels over openings: lintel block filled with grout (in the grout
	 *  order), or formed and poured with concrete (counted on their own,
	 *  no grout or block there). Default grouted. */
	lintel?: LintelKind;
}

export type LintelKind = 'grout' | 'poured';

/** Block actually laid: a nominal width less the 3/8" joint. */
export const actualWidth = (w: CmuWidth) => w - 0.375;

/** Length, corners, ends and openings of walls drawn one by one. Each
 *  wall runs through the corner at its end and the next butts it (as on
 *  the plan), so lengths simply add up with nothing to take off. Ends:
 *  both ends of walls that don't close, and both jambs of each door and
 *  window. */
export function wallTotals(runs: Run[], closed: boolean, heightIn: number) {
	const shut = closed && runs.length > 2;
	const openings = runs.flatMap((r) => r.openings);
	return {
		lengthIn: runs.reduce((s, r) => s + Math.max(0, r.length), 0),
		outside: false,
		corners: Math.max(0, runs.length - 1) + (shut ? 1 : 0),
		ends: (runs.length && !shut ? 2 : 0) + 2 * openings.length,
		openingsSf:
			openings.reduce((s, o) => {
				const b = o.kind === 'door' ? 0 : Math.max(0, o.sill);
				return s + Math.max(0, o.width) * Math.max(0, Math.min(heightIn, b + o.height) - b);
			}, 0) / 144
	};
}

export interface GroutResult {
	netLengthIn: number;
	cells: number | null;
	netFt3: number;
	wasteFt3: number;
	totalFt3: number;
	totalYd3: number;
	orderYd3: number;
	blocks: number;
	/** Lintels over doors and windows (drawn walls only), and the grout in
	 *  them: part of netFt3, shown on its own. */
	lintels: number;
	lintelFt3: number;
	/** Concrete for poured lintels, ft³ neat (not in the grout order). */
	pouredFt3: number;
}

/** A lintel (bond beam) over a door or window: one course deep up to
 *  6′ wide, two courses wider than that, bearing 8″ past each side. */
export const LINTEL_BEARING = 8;
export const lintelDepth = (width: number) => (width <= 72 ? COURSE_IN : 2 * COURSE_IN);

export interface WallGrout {
	/** Grouted cells standing up the wall: center x, bottom, top (in). */
	columns: { x: number; y0: number; y1: number }[];
	/** Lintels over the openings: left, right, bottom, top (in). */
	lintels: { a: number; b: number; y0: number; y1: number }[];
	/** Openings: left, right, bottom, top (in). */
	holes: [number, number, number, number][];
	/** 8″ × 8″ cells grouted: in all, and of those in lintels. */
	cells: number;
	lintelCells: number;
	/** Vertical cell lines grouted (some split by an opening). */
	cellLines: number;
}

/** Which cells of one wall get grout, as an 8″ grid (cell × course):
 *  - every cell, when solid; else cells at the spacing,
 *  - the cell each side of every door and window, whatever the spacing,
 *  - `cellsPerCorner` cells at an end that turns a corner, one at a free end,
 *  - a lintel over each opening (unless `poured`: then the lintel's cells
 *    are concrete, not grout, and are left out of `cells`);
 *  never inside an opening (taken out to the block module). */
export function wallGrout(run: Run, atStart: boolean, atEnd: boolean, heightIn: number, spacingIn: number, cellsPerCorner: number, poured = false): WallGrout {
	const L = Math.max(0, run.length);
	const n = Math.max(1, Math.round(L / COURSE_IN));
	const courses = Math.max(1, Math.round(Math.max(COURSE_IN, heightIn) / COURSE_IN));
	const H = courses * COURSE_IN;
	const solid = !spacingIn || spacingIn <= COURSE_IN;
	// Openings are laid to the block module: sides out to the 8″ grid
	// (a 36″ door gets a 40″ masonry opening), sill down and head up to a
	// course line.
	const down = (v: number) => Math.floor(v / COURSE_IN + 1e-9) * COURSE_IN;
	const up = (v: number) => Math.ceil(v / COURSE_IN - 1e-9) * COURSE_IN;
	const holes = place(run, H).map((p) => [Math.max(0, down(p.a)), Math.min(L, up(p.b)), down(p.sill), Math.min(H, up(p.head))] as [number, number, number, number]);
	const cellAt = (x: number) => Math.max(0, Math.min(n - 1, Math.floor(x / COURSE_IN)));

	const cols = new Set<number>();
	if (solid) for (let i = 0; i < n; i++) cols.add(i);
	else {
		groutedCells(L, spacingIn).forEach((g, i) => g && cols.add(i));
		const k = Math.max(1, cellsPerCorner);
		for (let j = 0; j < (atStart ? k : 1); j++) cols.add(Math.min(n - 1, j));
		for (let j = 0; j < (atEnd ? k : 1); j++) cols.add(Math.max(0, n - 1 - j));
		for (const [a, b] of holes) {
			cols.add(cellAt(a - COURSE_IN / 2));
			cols.add(cellAt(b + COURSE_IN / 2));
		}
	}
	const lintels = holes
		.filter(([, , , top]) => top < H - 0.01)
		.map(([a, b, , top]) => ({
			a: Math.max(0, a - LINTEL_BEARING),
			b: Math.min(L, b + LINTEL_BEARING),
			y0: top,
			y1: Math.min(H, top + lintelDepth(b - a))
		}));

	const open = (x: number, y: number) => holes.some(([a, b, bot, top]) => x > a && x < b && y > bot && y < top);
	const inLintel = (x: number, y: number) => lintels.some((l) => x > l.a && x < l.b && y > l.y0 && y < l.y1);
	let cells = 0;
	let lintelCells = 0;
	const columns: WallGrout['columns'] = [];
	const lines = new Set<number>();
	for (let i = 0; i < n; i++) {
		const x = Math.min(L - COURSE_IN / 2, i * COURSE_IN + COURSE_IN / 2);
		let start: number | null = null;
		for (let k = 0; k <= courses; k++) {
			const y = k * COURSE_IN + COURSE_IN / 2;
			const lin = k < courses && !open(x, y) && inLintel(x, y);
			const up = k < courses && cols.has(i) && !open(x, y) && !(poured && lin);
			if (lin) lintelCells++;
			if (up || (lin && !poured)) cells++;
			if (up && start === null) start = k * COURSE_IN;
			if (!up && start !== null) {
				columns.push({ x, y0: start, y1: k * COURSE_IN });
				lines.add(i);
				start = null;
			}
		}
	}
	return { columns, lintels, holes, cells, lintelCells, cellLines: lines.size };
}

/** wallGrout for each of the walls, knowing which ends turn corners. */
export function wallsGrout(runs: Run[], closed: boolean, heightIn: number, spacingIn: number, cellsPerCorner: number, lintel: LintelKind = 'grout'): WallGrout[] {
	const shut = closed && runs.length > 2;
	return runs.map((r, i) => wallGrout(r, i > 0 || shut, i < runs.length - 1 || shut, heightIn, spacingIn, cellsPerCorner, lintel === 'poured'));
}

export function groutVolume(input: GroutInput): GroutResult {
	const i = input.runs ? { ...input, ...wallTotals(input.runs, !!input.closed, input.heightIn) } : input;
	const deduct = i.outside ? Math.max(0, i.corners) * i.width : 0;
	const netLengthIn = Math.max(0, i.lengthIn - deduct);
	const lengthFt = netLengthIn / 12;
	const heightFt = Math.max(0, i.heightIn) / 12;
	let netFt3: number;
	let cells: number | null = null;
	const grid = input.runs ? wallsGrout(input.runs, !!input.closed, i.heightIn, i.spacingIn, i.cellsPerCorner, input.lintel) : null;
	const poured = !!grid && input.lintel === 'poured';
	/** 8″ × 8″ cells of wall face taken by lintels. */
	const lintelCells = grid ? grid.reduce((n, w) => n + w.lintelCells, 0) : 0;
	/** Grout in one 8″ × 8″ cell. */
	const cellFt3 = cellFt3PerFt(i.width) * (COURSE_IN / 12);
	if (!i.spacingIn || i.spacingIn <= COURSE_IN) {
		const area = Math.max(0, lengthFt * heightFt - Math.max(0, i.openingsSf));
		netFt3 = area * (SOLID_FT3_PER_100SF[i.width] / 100 / (1 + TABLE_WASTE));
		// A poured lintel is concrete where the grouted block would be.
		if (poured) netFt3 = Math.max(0, netFt3 - lintelCells * cellFt3);
	} else if (!grid) {
		const spaced = netLengthIn > 0 ? Math.ceil(netLengthIn / i.spacingIn) : 0;
		cells = spaced + Math.max(0, i.corners) * Math.max(0, i.cellsPerCorner) + Math.max(0, i.ends);
		netFt3 = cells * heightFt * cellFt3PerFt(i.width);
	} else {
		// Drawn walls, partly grouted: count the grid cells (columns, jambs,
		// corners and lintels, none counted twice).
		cells = grid.reduce((n, w) => n + w.cellLines, 0);
		netFt3 = grid.reduce((n, w) => n + w.cells, 0) * cellFt3;
	}
	const lintels = grid ? grid.reduce((n, w) => n + w.lintels.length, 0) : 0;
	const lintelFt3 = poured ? 0 : lintelCells * cellFt3;
	const lintelSf = (lintelCells * COURSE_IN * COURSE_IN) / 144;
	const pouredFt3 = poured ? (lintelSf * actualWidth(i.width)) / 12 : 0;
	const wasteFt3 = netFt3 * Math.max(0, i.wastePct) / 100;
	const totalFt3 = netFt3 + wasteFt3 + Math.max(0, i.pumpYd3) * FT3_PER_YD3;
	const totalYd3 = totalFt3 / FT3_PER_YD3;
	// 1.125 units per sq ft of wall face (16" × 8" nominal).
	// Poured lintels take the place of block.
	const blocks = Math.ceil(Math.max(0, lengthFt * heightFt - Math.max(0, i.openingsSf) - (poured ? lintelSf : 0)) * 1.125 - 1e-9);
	return { netLengthIn, cells, netFt3, wasteFt3, totalFt3, totalYd3, orderYd3: roundUpQuarter(totalYd3), blocks, lintels, lintelFt3, pouredFt3 };
}

/** Which 8" cell positions along a straight wall get grout (for the
 *  drawing): every one when solid, else at the spacing plus both ends. */
export function groutedCells(lengthIn: number, spacingIn: number): boolean[] {
	const n = Math.max(1, Math.round(lengthIn / COURSE_IN));
	if (!spacingIn || spacingIn <= COURSE_IN) return Array(n).fill(true);
	const step = Math.max(1, Math.round(spacingIn / COURSE_IN));
	return Array.from({ length: n }, (_, k) => k === 0 || k === n - 1 || k % step === 0);
}
