// One value being typed on the keypad, kept as the raw keystrokes over a
// small alphabet -- digits, '.', "'" (feet), '"' (inches) and '/'
// (fraction) -- so backspace is just dropping the last character, and the
// display is a pretty rendering of the same string.
//
// Reading order is how a tape measure is read aloud: feet, inches, then
// the fraction of an inch.
//
//   5'          5 feet
//   5'3         5 feet 3 inches (inches implied after feet)
//   5'3"1/2     5 feet 3 1/2 inches
//   3"1/2       3 1/2 inches
//   3/4"        3/4 inch
//   3/4         0.75 (no unit: a plain number)
//   12.5'       12.5 feet
//
// A unit picked from the unit sheet (sq ft, cu yd, m...) tags the entry
// instead; it is only allowed on entries without feet / inch marks.

import { fromUnit, type Quantity, type UnitId, UNITS } from './units';

export interface Entry {
	raw: string;
	unit: UnitId | null;
	/** An empty entry's suggested unit: the first digit typed takes it
	 *  (after + or −, the unit of the number before). */
	hint?: UnitId | null;
	/** The unit came from the hint: the feet / inch keys replace it. */
	auto?: boolean;
	/** The entry is added to or taken from a length: a bare fraction
	 *  (3/4) is inches here, as on a tape, unless marked otherwise. */
	fracIn?: boolean;
}

export const emptyEntry = (): Entry => ({ raw: '', unit: null });

export type EntryKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'ft' | 'in' | 'frac';

const MAX_DIGITS = 12;

/** The part after the last mark: the digits being typed now. */
function tail(raw: string): string {
	const m = raw.match(/[^'"/]*$/);
	return m ? m[0] : '';
}

// Unit cycling: pressing the feet key again turns a feet-only number into
// square feet, again into cubic feet, again back to feet (5′ -> 5 sq ft ->
// 5 cu ft -> 5′); the inch key does the same with inches. A plain number
// with a fraction counts (3/4″ -> 3/4 sq in).
const FEET_ONLY = /^[\d.]+'$/;
const INCH_ONLY = /^(?:[\d.]+|\d+\/\d+)"$/;
const PLAIN = /^(?:[\d.]*\d[\d.]*|\d+\/\d+)$/;
const CYCLE: Record<'ft' | 'in', { mark: string; only: RegExp; sq: UnitId; cu: UnitId }> = {
	ft: { mark: "'", only: FEET_ONLY, sq: 'sqft', cu: 'cuft' },
	in: { mark: '"', only: INCH_ONLY, sq: 'sqin', cu: 'cuin' }
};

function cycled(e: Entry, key: 'ft' | 'in'): Entry | null {
	const c = CYCLE[key];
	if (e.unit === null && c.only.test(e.raw)) return { raw: e.raw.slice(0, -1), unit: c.sq };
	if (e.unit === c.sq) return { ...e, unit: c.cu };
	if (e.unit === c.cu) return { raw: e.raw + c.mark, unit: null };
	return null;
}

/** The number of an entry that is just one value of feet or inches (any
 *  power), or a plain number; null otherwise (5′ 3″, a metric tag...). */
function baseNumber(e: Entry): string | null {
	if (e.unit === null) {
		if (PLAIN.test(e.raw)) return e.raw;
		if (FEET_ONLY.test(e.raw) || INCH_ONLY.test(e.raw)) return e.raw.slice(0, -1);
		return null;
	}
	return ['sqft', 'cuft', 'sqin', 'cuin'].includes(e.unit) && PLAIN.test(e.raw) ? e.raw : null;
}

/** Long-press choice: make the entry feet / inches, square or cubic. */
export function withPower(e: Entry, key: 'ft' | 'in', power: 1 | 2 | 3): Entry | null {
	const n = baseNumber(e);
	if (n === null) return null;
	const c = CYCLE[key];
	if (power === 1) return { raw: n + c.mark, unit: null };
	return { raw: n, unit: power === 2 ? c.sq : c.cu };
}

export const canSetPower = (e: Entry) => baseNumber(e) !== null;

/** Whether `key` makes sense right now; the keypad greys out the rest.
 *  `cycle`: whether the feet/inch keys may turn the value into an area or
 *  a volume (not in fields that hold a length). */
export function canPress(e: Entry, key: EntryKey, cycle = true): boolean {
	// A suggested unit gives way to a feet or inch mark typed on purpose.
	if (e.auto && (key === 'ft' || key === 'in')) return canPress({ raw: e.raw, unit: null }, key, cycle);
	if (cycle && (key === 'ft' || key === 'in') && cycled(e, key)) return true;
	const r = e.raw;
	const t = tail(r);
	const hasFt = r.includes("'");
	const hasIn = r.includes('"');
	const hasFrac = r.includes('/');
	const inFrac = hasFrac && r.lastIndexOf('/') > r.lastIndexOf('"');
	if (/^\d$/.test(key)) {
		if (r.replace(/\D/g, '').length >= MAX_DIGITS) return false;
		// Nothing goes after a closed fraction like 3/4".
		if (hasFrac && r.endsWith('"') && r.indexOf('/') < r.lastIndexOf('"')) return false;
		return true;
	}
	// Decimals in feet or inches (12.5', 5'3.5); never in a fraction, nor
	// after an inch mark (what follows it is the fraction's numerator).
	if (key === '.') return !t.includes('.') && !hasFrac && !hasIn;
	if (key === 'ft') return e.unit === null && !hasFt && !hasIn && !hasFrac && /\d/.test(t);
	if (key === 'in') {
		if (e.unit !== null || hasIn) return false;
		// 3" or 5'3" or 3/4" (a complete fraction).
		if (inFrac) return /\/\d+$/.test(r) && Number(r.slice(r.lastIndexOf('/') + 1)) > 0;
		return /\d/.test(t);
	}
	if (key === 'frac') {
		if (hasFrac || !/^\d+$/.test(t)) return false;
		return true;
	}
	return false;
}

export function press(e: Entry, key: EntryKey, cycle = true): Entry {
	// First digit of an entry with a suggested unit: take the unit.
	if (e.raw === '' && e.unit === null && e.hint && (/^\d$/.test(key) || key === '.')) {
		return { raw: key === '.' ? '0.' : key, unit: e.hint, auto: true, fracIn: e.fracIn };
	}
	// A bare fraction next to a length is inches (12' + 3/4 is 12' 3/4"),
	// even where the number before was in feet.
	if (key === 'frac' && /^\d+$/.test(e.raw) && (e.fracIn || (e.auto && e.unit === 'ft')) && (e.unit === null || e.auto)) {
		return { ...e, raw: e.raw + '/', unit: 'in', auto: true };
	}
	if (e.auto && (key === 'ft' || key === 'in')) return press({ raw: e.raw, unit: null }, key, cycle);
	if (cycle && (key === 'ft' || key === 'in')) {
		const next = cycled(e, key);
		if (next) return next;
	}
	if (!canPress(e, key, false)) return e;
	const ch = key === 'ft' ? "'" : key === 'in' ? '"' : key === 'frac' ? '/' : key;
	let raw = e.raw;
	if (key === '.' && (raw === '' || /['"]$/.test(raw))) raw += '0';
	return { ...e, raw: raw + ch };
}

export function backspace(e: Entry): Entry {
	// A suggested unit stays while digits go; with the last digit gone the
	// entry is back to empty, still suggesting it.
	if (e.auto && e.unit) {
		const raw = e.raw.slice(0, -1);
		return raw === '' ? { raw: '', unit: null, hint: e.unit } : { ...e, raw };
	}
	if (e.unit) return { ...e, unit: null };
	return { ...e, raw: e.raw.slice(0, -1) };
}

export const isEmpty = (e: Entry) => e.raw === '' && e.unit === null;

/** The single unit an entry is in, to suggest for the next number:
 *  a tagged unit, or feet / inches when the entry is only one of them. */
export function unitOf(e: Entry): UnitId | null {
	if (e.unit) return e.unit;
	if (FEET_ONLY.test(e.raw)) return 'ft';
	if (INCH_ONLY.test(e.raw)) return 'in';
	return null;
}

/** Feet, inches, fraction pieces of a raw entry (strings as typed). */
interface Parts {
	feet: string | null;
	inches: string | null;
	num: string | null;
	den: string | null;
	/** An inch mark was typed (or implied by feet). */
	marked: boolean;
}

function parts(raw: string): Parts {
	let rest = raw;
	let feet: string | null = null;
	const fi = rest.indexOf("'");
	if (fi >= 0) {
		feet = rest.slice(0, fi);
		rest = rest.slice(fi + 1);
	}
	let inches: string | null = null;
	let num: string | null = null;
	let den: string | null = null;
	let marked = rest.includes('"');
	const ii = rest.indexOf('"');
	const si = rest.indexOf('/');
	if (si >= 0 && (ii < 0 || si < ii)) {
		// The fraction comes before any inch mark: "3/4" or "3/4"" or "5'3/8".
		num = rest.slice(0, si);
		den = rest.slice(si + 1).replace('"', '');
	} else if (ii >= 0) {
		inches = rest.slice(0, ii);
		const after = rest.slice(ii + 1);
		if (after) {
			const s = after.indexOf('/');
			if (s >= 0) {
				num = after.slice(0, s);
				den = after.slice(s + 1);
			} else num = after;
		}
	} else if (rest) {
		inches = rest;
	}
	if (feet !== null) marked = true;
	return { feet, inches, num, den, marked };
}

/** The value of an entry, or null when there is nothing to read yet. */
export function entryValue(e: Entry): Quantity | null {
	if (e.raw === '') return null;
	const p = parts(e.raw);
	const n = (s: string | null) => (s && s !== '.' ? Number(s) : 0);
	let fraction = 0;
	if (p.num !== null && p.den !== null && p.den !== '') {
		const den = Number(p.den);
		if (den > 0) fraction = n(p.num) / den;
	}
	if (p.marked) {
		return { v: n(p.feet) * 12 + n(p.inches) + fraction, d: 1 };
	}
	const plain = n(p.inches) + fraction;
	if (e.unit) return fromUnit(plain, e.unit);
	return { v: plain, d: 0 };
}

/** The entry for the display: 5′ 3 1/2″. */
export function formatEntry(e: Entry): string {
	if (e.raw === '') return e.unit ? UNITS[e.unit].label : '';
	if (e.unit === 'ft') return `${e.raw}′`;
	if (e.unit === 'in') return `${e.raw}″`;
	const p = parts(e.raw);
	const out: string[] = [];
	if (p.feet !== null) out.push(`${p.feet}′`);
	let inch = p.inches ?? '';
	if (p.num !== null) {
		const fracText = p.den !== null ? `${p.num}/${p.den}` : p.num;
		inch = inch ? `${inch} ${fracText}` : fracText;
	}
	const closed = e.raw.includes('"');
	if (inch) out.push(inch + (closed ? '″' : ''));
	let text = out.join(' ');
	if (e.unit) text += ` ${UNITS[e.unit].label}`;
	return text;
}

/** Parse typed text ("12' 6 1/2\"", "6-1/2", "3.5 ft", "120 sq ft") into a
 *  quantity: for inputs typed with a keyboard (the web) and for tests. */
export function parseText(text: string): Quantity | null {
	let s = text.trim().toLowerCase().replace(/[′’‘]/g, "'").replace(/[″”“]/g, '"').replace(/⁄/g, '/');
	if (!s) return null;
	const unitMatch = s.match(/^(-?[\d.,\s/]+)\s*([a-z²³ ]+)$/);
	if (unitMatch && !/['"]/.test(s)) {
		const label = unitMatch[2].trim().replace(/\s+/g, ' ');
		const aliases: Record<string, UnitId> = {
			in: 'in', inch: 'in', inches: 'in', ft: 'ft', feet: 'ft', foot: 'ft', yd: 'yd', yard: 'yd', yards: 'yd',
			mm: 'mm', cm: 'cm', m: 'm', 'sq in': 'sqin', 'sq ft': 'sqft', sf: 'sqft', 'sq yd': 'sqyd', sy: 'sqyd', 'm²': 'm2', m2: 'm2',
			'cu in': 'cuin', 'cu ft': 'cuft', cf: 'cuft', 'cu yd': 'cuyd', cy: 'cuyd', yd3: 'cuyd', 'm³': 'm3', m3: 'm3', gal: 'gal'
		};
		const u = aliases[label];
		const v = plainNumber(unitMatch[1]);
		if (u && v !== null) return fromUnit(v, u);
		return null;
	}
	const neg = s.startsWith('-');
	if (neg) s = s.slice(1).trim();
	let total = 0;
	let marked = false;
	const ft = s.match(/^([\d.]+)\s*'\s*-?\s*/);
	if (ft) {
		total += Number(ft[1]) * 12;
		s = s.slice(ft[0].length);
		marked = true;
	}
	if (s.endsWith('"')) {
		s = s.slice(0, -1).trim();
		marked = true;
	}
	if (s) {
		// 6, 6.5, 6 1/2, 6-1/2, 1/2
		// 6, 6.5, 6 1/2, 6-1/2, 1/2, 10/2 (a whole number needs a space or a
		// dash before its fraction, so 10/2 is not 1 0/2)
		const m = s.match(/^(?:([\d.]+)(?:(?:\s+|-)(\d+)\/(\d+))?|(\d+)\/(\d+))$/);
		if (!m) return null;
		const whole = m[1] ? Number(m[1]) : 0;
		const f = m[2] ? Number(m[2]) / Number(m[3]) : m[4] ? Number(m[4]) / Number(m[5]) : 0;
		if (!isFinite(whole) || !isFinite(f)) return null;
		total += whole + f;
	}
	const v = neg ? -total : total;
	return marked ? { v, d: 1 } : { v, d: 0 };
}

function plainNumber(s: string): number | null {
	const t = s.replace(/,/g, '').trim();
	const m = t.match(/^(-?[\d.]+)?(?:\s+)?(?:(\d+)\/(\d+))?$/);
	if (!m || (!m[1] && !m[2])) return null;
	return (m[1] ? Number(m[1]) : 0) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
}
