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
}

export function groutVolume(i: GroutInput): GroutResult {
	const deduct = i.outside ? Math.max(0, i.corners) * i.width : 0;
	const netLengthIn = Math.max(0, i.lengthIn - deduct);
	const lengthFt = netLengthIn / 12;
	const heightFt = Math.max(0, i.heightIn) / 12;
	let netFt3: number;
	let cells: number | null = null;
	if (!i.spacingIn || i.spacingIn <= COURSE_IN) {
		const area = Math.max(0, lengthFt * heightFt - Math.max(0, i.openingsSf));
		netFt3 = area * (SOLID_FT3_PER_100SF[i.width] / 100 / (1 + TABLE_WASTE));
	} else {
		const spaced = netLengthIn > 0 ? Math.ceil(netLengthIn / i.spacingIn) : 0;
		cells = spaced + Math.max(0, i.corners) * Math.max(0, i.cellsPerCorner) + Math.max(0, i.ends);
		netFt3 = cells * heightFt * cellFt3PerFt(i.width);
	}
	const wasteFt3 = netFt3 * Math.max(0, i.wastePct) / 100;
	const totalFt3 = netFt3 + wasteFt3 + Math.max(0, i.pumpYd3) * FT3_PER_YD3;
	const totalYd3 = totalFt3 / FT3_PER_YD3;
	// 1.125 units per sq ft of wall face (16" × 8" nominal).
	const blocks = Math.ceil(Math.max(0, lengthFt * heightFt - Math.max(0, i.openingsSf)) * 1.125 - 1e-9);
	return { netLengthIn, cells, netFt3, wasteFt3, totalFt3, totalYd3, orderYd3: roundUpQuarter(totalYd3), blocks };
}

/** Which 8" cell positions along a straight wall get grout (for the
 *  drawing): every one when solid, else at the spacing plus both ends. */
export function groutedCells(lengthIn: number, spacingIn: number): boolean[] {
	const n = Math.max(1, Math.round(lengthIn / COURSE_IN));
	if (!spacingIn || spacingIn <= COURSE_IN) return Array(n).fill(true);
	const step = Math.max(1, Math.round(spacingIn / COURSE_IN));
	return Array.from({ length: n }, (_, k) => k === 0 || k === n - 1 || k % step === 0);
}
