// Quantities and units. Every quantity is kept in inches raised to its
// dimension: a plain number (dim 0), a length in inches (1), an area in
// square inches (2), a volume in cubic inches (3). Units are just factors
// onto that base, so converting is one multiply and one divide.

export type Dim = 0 | 1 | 2 | 3;

export interface Quantity {
	/** Value in in^dim. */
	v: number;
	d: Dim;
}

export type UnitId =
	| 'in' | 'ft' | 'yd' | 'mm' | 'cm' | 'm'
	| 'sqin' | 'sqft' | 'sqyd' | 'm2'
	| 'cuin' | 'cuft' | 'cuyd' | 'm3' | 'gal';

export interface Unit {
	id: UnitId;
	d: Dim;
	/** How many in^d one of this unit is. */
	factor: number;
	/** Short suffix shown after a number ("sq ft"). */
	label: string;
	/** Longer name for pickers. */
	name: string;
}

const M = 1 / 0.0254; // inches per meter (exact by definition)

export const UNITS: Record<UnitId, Unit> = {
	in: { id: 'in', d: 1, factor: 1, label: 'in', name: 'Inches' },
	ft: { id: 'ft', d: 1, factor: 12, label: 'ft', name: 'Feet' },
	yd: { id: 'yd', d: 1, factor: 36, label: 'yd', name: 'Yards' },
	mm: { id: 'mm', d: 1, factor: M / 1000, label: 'mm', name: 'Millimeters' },
	cm: { id: 'cm', d: 1, factor: M / 100, label: 'cm', name: 'Centimeters' },
	m: { id: 'm', d: 1, factor: M, label: 'm', name: 'Meters' },
	sqin: { id: 'sqin', d: 2, factor: 1, label: 'sq in', name: 'Square inches' },
	sqft: { id: 'sqft', d: 2, factor: 144, label: 'sq ft', name: 'Square feet' },
	sqyd: { id: 'sqyd', d: 2, factor: 1296, label: 'sq yd', name: 'Square yards' },
	m2: { id: 'm2', d: 2, factor: M * M, label: 'm²', name: 'Square meters' },
	cuin: { id: 'cuin', d: 3, factor: 1, label: 'cu in', name: 'Cubic inches' },
	cuft: { id: 'cuft', d: 3, factor: 1728, label: 'cu ft', name: 'Cubic feet' },
	cuyd: { id: 'cuyd', d: 3, factor: 46656, label: 'cu yd', name: 'Cubic yards' },
	m3: { id: 'm3', d: 3, factor: M * M * M, label: 'm³', name: 'Cubic meters' },
	gal: { id: 'gal', d: 3, factor: 231, label: 'gal', name: 'US gallons' }
};

export const UNITS_BY_DIM: Record<1 | 2 | 3, UnitId[]> = {
	1: ['ft', 'in', 'yd', 'm', 'cm', 'mm'],
	2: ['sqft', 'sqin', 'sqyd', 'm2'],
	3: ['cuyd', 'cuft', 'cuin', 'm3', 'gal']
};

export const DIM_NAME: Record<Dim, string> = { 0: 'Number', 1: 'Length', 2: 'Area', 3: 'Volume' };

export const q = (v: number, d: Dim = 0): Quantity => ({ v, d });
export const inches = (v: number): Quantity => ({ v, d: 1 });
export const fromUnit = (value: number, unit: UnitId): Quantity => ({ v: value * UNITS[unit].factor, d: UNITS[unit].d });
export const toUnit = (x: Quantity, unit: UnitId): number => x.v / UNITS[unit].factor;

// ---------------------------------------------------------------- formatting

/** Fraction precisions offered: the denominator. */
export const PRECISIONS = [2, 4, 8, 16, 32, 64] as const;
export type Precision = (typeof PRECISIONS)[number];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export interface FtIn {
	neg: boolean;
	feet: number;
	inches: number;
	num: number;
	den: number;
	/** The rounded value differs from the real one. */
	rounded: boolean;
}

/** Split inches into feet, whole inches and a reduced fraction at the
 *  given precision (rounded to the nearest 1/den). */
export function splitFtIn(totalIn: number, den: number, useFeet = true): FtIn {
	const neg = totalIn < 0;
	const abs = Math.abs(totalIn);
	const ticks = Math.round(abs * den);
	const rounded = Math.abs(ticks / den - abs) > 1e-9;
	let whole = Math.floor(ticks / den);
	let num = ticks - whole * den;
	let d = den;
	if (num) {
		const g = gcd(num, d);
		num /= g;
		d /= g;
	}
	const feet = useFeet ? Math.floor(whole / 12) : 0;
	whole -= feet * 12;
	return { neg: neg && ticks > 0, feet, inches: whole, num, den: d, rounded };
}

/** "1/2". A plain slash: the fraction-slash character (U+2044) makes
 *  some Android fonts draw half-formed super/subscript digits, and "/"
 *  can't be mistaken for division, which is ÷. */
export const frac = (num: number, den: number) => `${num}/${den}`;

/** 5′ 3 1/2″ style. `inchesOnly` gives 63 1/2″. */
export function formatFtIn(totalIn: number, den: number, inchesOnly = false): string {
	const p = splitFtIn(totalIn, den, !inchesOnly);
	const parts: string[] = [];
	if (p.feet) parts.push(`${p.feet.toLocaleString('en-US')}′`);
	let inch = '';
	if (p.inches || !p.num) inch = String(p.inches);
	if (p.num) inch = (inch ? inch + ' ' : '') + frac(p.num, p.den);
	if (inch && (inch !== '0' || !p.feet)) parts.push(inch + '″');
	return (p.neg ? '−' : '') + parts.join(' ');
}

/** A plain decimal: up to `max` decimals, trailing zeros trimmed, grouped. */
export function formatNumber(x: number, max = 4): string {
	if (!isFinite(x)) return 'Error';
	const abs = Math.abs(x);
	if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) return x.toExponential(4).replace('-', '−');
	const s = x.toLocaleString('en-US', { maximumFractionDigits: max, minimumFractionDigits: 0 });
	return s.replace('-', '−');
}

export type LengthFormat = 'ftin' | 'in' | UnitId;

export interface Formatted {
	text: string;
	/** Rounded to the fraction precision (a ≈ marker is worth showing). */
	rounded: boolean;
}

/** A quantity in one unit or format. */
export function formatAs(x: Quantity, fmt: LengthFormat, den: number): Formatted {
	if (x.d === 0) return { text: formatNumber(x.v, 6), rounded: false };
	if (fmt === 'ftin' || (fmt === 'in' && x.d === 1)) {
		if (x.d !== 1) return formatAs(x, defaultFormat(x.d), den);
		const p = splitFtIn(x.v, den);
		return { text: formatFtIn(x.v, den, fmt === 'in'), rounded: p.rounded };
	}
	const u = UNITS[fmt as UnitId];
	if (!u || u.d !== x.d) return formatAs(x, defaultFormat(x.d), den);
	const value = toUnit(x, u.id);
	const decimals = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 4 : 5;
	return { text: `${formatNumber(value, decimals)} ${u.label}`, rounded: false };
}

export function defaultFormat(d: Dim): LengthFormat {
	return d === 1 ? 'ftin' : d === 2 ? 'sqft' : d === 3 ? 'cuyd' : 'in';
}

/** The formats a result can be shown in, by dimension. */
export function formatsFor(d: Dim): { id: LengthFormat; label: string }[] {
	if (d === 1)
		return [
			{ id: 'ftin', label: 'ft-in' },
			{ id: 'in', label: 'in' },
			{ id: 'ft', label: 'ft' },
			{ id: 'yd', label: 'yd' },
			{ id: 'm', label: 'm' },
			{ id: 'mm', label: 'mm' }
		];
	if (d === 2 || d === 3) return UNITS_BY_DIM[d].map((id) => ({ id, label: UNITS[id].label }));
	return [];
}
