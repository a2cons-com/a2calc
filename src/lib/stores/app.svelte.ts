// App-wide state: preferences, the calculator (with its tape) and the last
// inputs of each takeoff, all kept between launches.

import { initialState, type CalcState } from '$lib/calc/calculator';
import type { LengthFormat, Precision, UnitId } from '$lib/calc/units';
import { PIECE_DEFAULTS, type Piece } from '$lib/takeoff/concrete';
import type { GroutInput } from '$lib/takeoff/grout';
import type { WallInput } from '$lib/takeoff/framing';
import { persisted } from './persist.svelte';

export const prefs = persisted('prefs', {
	precision: 16 as Precision,
	/** Display format of a result, by dimension. */
	fmt: { 1: 'ftin', 2: 'sqft', 3: 'cuyd' } as Record<1 | 2 | 3, LengthFormat>,
	haptics: true,
	disclaimerSeen: false
});

export const calc = persisted('calc', { s: initialState() as CalcState });

let nextId = Date.now();
export const newId = () => ++nextId;

export const concrete = persisted('concrete', {
	pieces: [{ id: 1, kind: 'slab', a: PIECE_DEFAULTS.slab[0], b: PIECE_DEFAULTS.slab[1], c: PIECE_DEFAULTS.slab[2], count: 1 }] as Piece[],
	wastePct: 5,
	pumpYd3: 0,
	selected: 0
});

export const grout = persisted('grout', {
	width: 8,
	lengthIn: 480,
	outside: true,
	heightIn: 96,
	spacingIn: 48,
	corners: 0,
	ends: 2,
	cellsPerCorner: 1,
	openingsSf: 0,
	wastePct: 3,
	pumpYd3: 0,
	runs: [{ id: 5, length: 480, openings: [] }],
	closed: false,
	lintel: 'grout'
} as GroutInput & Required<Pick<GroutInput, 'runs' | 'closed' | 'lintel'>>);

export const wall = persisted('wall', {
	member: '2x4',
	spacing: 16,
	height: 97.125,
	topPlates: 2,
	bottomPlates: 1,
	stock: 192,
	closed: false,
	wastePct: 10,
	runs: [
		{ id: 1, length: 168, openings: [{ id: 2, kind: 'window', width: 36, height: 48, sill: 36, offset: null, header: '2x10' }] },
		{ id: 3, length: 120, openings: [{ id: 4, kind: 'door', width: 38, height: 82.5, sill: 0, offset: null, header: '2x10' }] }
	]
} as WallInput);

export const convert = persisted('convert', {
	mode: 'length' as 'length' | 'area' | 'volume' | 'dims',
	lengthIn: 150.5,
	area: 120,
	areaUnit: 'sqft' as UnitId,
	volume: 2.5,
	volumeUnit: 'cuyd' as UnitId,
	dl: 240,
	dw: 144,
	dd: 4
});
