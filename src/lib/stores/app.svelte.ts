// App-wide state: preferences, the calculator (with its tape) and the last
// inputs of each takeoff, all kept between launches.

import { initialState, type CalcState } from '$lib/calc/calculator';
import type { LengthFormat, Precision, UnitId } from '$lib/calc/units';
import { PIECE_DEFAULTS, type Piece } from '$lib/takeoff/concrete';
import type { GroutInput } from '$lib/takeoff/grout';
import type { WallInput } from '$lib/takeoff/framing';
import type { StairInput } from '$lib/takeoff/stairs';
import { persisted } from './persist.svelte';

export const prefs = persisted('prefs', {
	precision: 16 as Precision,
	/** Display format of a result, by dimension. */
	fmt: { 1: 'ftin', 2: 'sqft', 3: 'cuyd' } as Record<1 | 2 | 3, LengthFormat>,
	haptics: true,
	/** Light or dark, or as the phone is set. */
	theme: 'system' as 'system' | 'light' | 'dark',
	disclaimerSeen: false
});

export const calc = persisted('calc', { s: initialState() as CalcState });

let nextId = Date.now();
export const newId = () => ++nextId;

// A takeoff's starting values: what a new one in a project begins with.
export const CONCRETE_DEFAULT = {
	pieces: [{ id: 1, kind: 'slab', a: PIECE_DEFAULTS.slab[0], b: PIECE_DEFAULTS.slab[1], c: PIECE_DEFAULTS.slab[2], count: 1 }] as Piece[],
	wastePct: 5,
	pumpYd3: 0,
	selected: 0
};
export type ConcreteData = typeof CONCRETE_DEFAULT;

export const GROUT_DEFAULT = {
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
} as GroutInput & Required<Pick<GroutInput, 'runs' | 'closed' | 'lintel'>>;
export type GroutData = typeof GROUT_DEFAULT;

export const WALL_DEFAULT: WallInput = {
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
};

export const STAIRS_DEFAULT: StairInput = {
	code: 'irc',
	rise: 108,
	finishBottom: 0.75,
	finishTop: 0.75,
	risers: null,
	tread: 10.5,
	nosing: 1,
	treadThk: 1,
	riserThk: 0.75,
	width: 36,
	landings: null,
	landingDepth: 36,
	floorDepth: 12.625,
	stringer: '2x12'
};

// The takeoff screens edit these; a takeoff opened from a project is copied
// in and saved back as it changes (stores/projects).
export const concrete = persisted('concrete', structuredClone(CONCRETE_DEFAULT));
export const grout = persisted('grout', structuredClone(GROUT_DEFAULT));
export const wall = persisted('wall', structuredClone(WALL_DEFAULT));
export const stairs = persisted('stairs', structuredClone(STAIRS_DEFAULT));

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
