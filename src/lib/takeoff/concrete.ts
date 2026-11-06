// Concrete to order: the neat volume of the pieces, plus waste, plus what
// the pump keeps, rounded up to the quarter yard ready-mix is sold in.
// All dimensions in inches.
//
// Waste has no code figure: formed members run ~3-5%, slabs and footings
// on ground ~5-10% (subgrade is rarely neat). Pump loss is what stays in
// the hopper and line at the end: ask the pump company; 1/4 to 1/2 yd is
// the usual allowance.

export const FT3_PER_YD3 = 27;
export const IN3_PER_YD3 = 46656;

export type PieceKind = 'slab' | 'footing' | 'wall' | 'beam' | 'column' | 'round';

export interface Piece {
	id: number;
	kind: PieceKind;
	/** Three dimensions in inches; meaning by kind (see PIECE_FIELDS). */
	a: number;
	b: number;
	c: number;
	count: number;
}

export const PIECE_NAMES: Record<PieceKind, string> = {
	slab: 'Slab',
	footing: 'Footing',
	wall: 'Wall',
	beam: 'Beam / tie beam',
	column: 'Column',
	round: 'Round column'
};

/** Field labels for a, b, c by kind (c is unused for a round column's b). */
export const PIECE_FIELDS: Record<PieceKind, [string, string, string | null]> = {
	slab: ['Length', 'Width', 'Thickness'],
	footing: ['Length', 'Width', 'Depth'],
	wall: ['Length', 'Height', 'Thickness'],
	beam: ['Length', 'Width', 'Depth'],
	column: ['Width', 'Depth', 'Height'],
	round: ['Diameter', 'Height', null]
};

/** Typical starting sizes (inches) when a piece is added. */
export const PIECE_DEFAULTS: Record<PieceKind, [number, number, number]> = {
	slab: [240, 240, 4],
	footing: [480, 20, 12],
	wall: [480, 96, 8],
	beam: [480, 8, 16],
	column: [12, 12, 120],
	round: [12, 120, 0]
};

export function pieceIn3(p: Piece): number {
	const pos = (v: number) => Math.max(0, v || 0);
	const n = Math.max(0, Math.floor(p.count || 0));
	if (p.kind === 'round') {
		const r = pos(p.a) / 2;
		return Math.PI * r * r * pos(p.b) * n;
	}
	return pos(p.a) * pos(p.b) * pos(p.c) * n;
}

export const roundUpQuarter = (yd3: number) => (yd3 <= 0 ? 0 : Math.ceil(yd3 * 4 - 1e-9) / 4);

export interface ConcreteResult {
	netIn3: number;
	netYd3: number;
	wasteYd3: number;
	pumpYd3: number;
	totalYd3: number;
	orderYd3: number;
}

export function concreteOrder(pieces: Piece[], wastePct: number, pumpYd3: number): ConcreteResult {
	const netIn3 = pieces.reduce((s, p) => s + pieceIn3(p), 0);
	const netYd3 = netIn3 / IN3_PER_YD3;
	const wasteYd3 = netYd3 * Math.max(0, wastePct) / 100;
	const pump = Math.max(0, pumpYd3);
	const totalYd3 = netYd3 + wasteYd3 + pump;
	return { netIn3, netYd3, wasteYd3, pumpYd3: pump, totalYd3, orderYd3: roundUpQuarter(totalYd3) };
}

/** 80 lb bags of premix for a small pour (0.6 cu ft each). */
export const bags80 = (in3: number) => Math.ceil(in3 / 1728 / 0.6 - 1e-9);
