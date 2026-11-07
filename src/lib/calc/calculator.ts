// The basic calculator's state machine, kept free of UI so it can be
// tested: keys go in, the expression / live result / tape come out.

import { backspace, canPress, canSetPower, emptyEntry, entryValue, isEmpty, parseText, press, unitOf, withPower, type Entry, type EntryKey } from './entry';
import { CalcError, evaluate, openParens, tokensText, tokenText, type Op, type Token } from './expression';
import { formatAs, defaultFormat, fromUnit, UNITS, type Dim, type LengthFormat, type Quantity, type UnitId } from './units';

export interface TapeLine {
	expr: string;
	result: Quantity;
	at: number;
}

export const VARS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type VarName = (typeof VARS)[number];

export interface CalcState {
	tokens: Token[];
	/** Memory: answers stored under a letter. */
	vars?: Partial<Record<VarName, Quantity>>;
	/** The result of the last '=', shown until the next key. */
	done: Quantity | null;
	error: string | null;
	tape: TapeLine[];
}

export const initialState = (): CalcState => ({ tokens: [{ kind: 'entry', entry: emptyEntry() }], done: null, error: null, tape: [] });

const TAPE_MAX = 200;

function current(s: CalcState): Entry | null {
	const last = s.tokens[s.tokens.length - 1];
	return last?.kind === 'entry' ? last.entry : null;
}

function setCurrent(s: CalcState, e: Entry): CalcState {
	const tokens = [...s.tokens];
	tokens[tokens.length - 1] = { kind: 'entry', entry: e };
	return { ...s, tokens, error: null };
}

/** Text of a value for the expression line (the result reused). */
export function valueText(v: Quantity, den: number, fmt?: LengthFormat): string {
	return formatAs(v, fmt ?? defaultFormat(v.d), den).text;
}

export function canKey(s: CalcState, key: EntryKey): boolean {
	if (s.done) return canPress(emptyEntry(), key);
	const e = current(s);
	return e ? canPress(e, key) : canPress(emptyEntry(), key);
}

export function key(s: CalcState, k: EntryKey): CalcState {
	// A new number after '=' starts over (the tape keeps the old one).
	if (s.done) s = { ...s, tokens: [{ kind: 'entry', entry: emptyEntry() }], done: null };
	const last = s.tokens[s.tokens.length - 1];
	if (last.kind === 'paren') {
		// A number right after ")" multiplies: (2′ + 3′)4 = (2′ + 3′) × 4.
		return { ...s, tokens: [...s.tokens, { kind: 'op', op: '×' }, { kind: 'entry', entry: press(emptyEntry(), k) }], error: null };
	}
	const e = current(s);
	if (!e) {
		// After a reused value: typing replaces it.
		const tokens = s.tokens.slice(0, -1);
		return { ...s, tokens: [...tokens, { kind: 'entry', entry: press(emptyEntry(), k) }], error: null };
	}
	return setCurrent(s, press(e, k));
}

/** The last token holds a finished operand (a number, a value or ")"). */
function hasOperand(s: CalcState): boolean {
	const last = s.tokens[s.tokens.length - 1];
	return last.kind === 'value' || (last.kind === 'paren' && last.p === ')') || (last.kind === 'entry' && entryValue(last.entry) !== null);
}

export function canParen(s: CalcState, p: '(' | ')'): boolean {
	if (p === '(') return true;
	return !s.done && openParens(s.tokens) > 0 && hasOperand(s);
}

export function paren(s: CalcState, p: '(' | ')', den: number, fmt?: LengthFormat): CalcState {
	if (!canParen(s, p)) return s;
	if (p === ')') return { ...s, tokens: [...s.tokens, { kind: 'paren', p: ')' }], error: null };
	if (s.done) {
		// "(" after an answer starts a new formula with the answer times it.
		return { ...s, tokens: [{ kind: 'value', value: s.done, text: valueText(s.done, den, fmt) }, { kind: 'op', op: '×' }, { kind: 'paren', p: '(' }, { kind: 'entry', entry: emptyEntry() }], done: null, error: null };
	}
	const tokens = [...s.tokens];
	if (hasOperand(s)) tokens.push({ kind: 'op', op: '×' });
	else tokens.pop(); // the empty entry
	return { ...s, tokens: [...tokens, { kind: 'paren', p: '(' }, { kind: 'entry', entry: emptyEntry() }], error: null };
}

/** Long-press on the feet or inch key: the current number as that unit,
 *  its square or its cube. */
export function canPower(s: CalcState): boolean {
	if (s.done) return false;
	const e = current(s);
	return !!e && canSetPower(e);
}

export function power(s: CalcState, key: 'ft' | 'in', p: 1 | 2 | 3): CalcState {
	if (s.done) return s;
	const e = current(s);
	const next = e && withPower(e, key, p);
	return next ? setCurrent(s, next) : s;
}

/** Tag the current entry with a unit (sq ft, cu yd, m...), or give a
 *  plain-number answer one. */
export function unit(s: CalcState, u: UnitId): CalcState {
	if (s.done) {
		// A plain-number answer takes the unit (10 × 12 = 120, then sq ft).
		// An answer that already has this kind of unit is only shown in it,
		// which the display does.
		if (s.done.d !== 0) return s;
		const v = fromUnit(s.done.v, u);
		const tape = s.tape.length ? [{ ...s.tape[0], expr: `${s.tape[0].expr} → ${UNITS[u].label}`, result: v }, ...s.tape.slice(1)] : s.tape;
		return { ...s, done: v, tape, error: null };
	}
	const e = current(s);
	if (!e || /['"]/.test(e.raw) || e.raw === '') return s;
	return setCurrent(s, { ...e, unit: u, auto: false });
}

/** The unit to suggest after + or −: the operand's own (a tagged unit, or
 *  feet / inches alone; for a value, the unit it is shown in). × and ÷
 *  suggest nothing: their second number is usually a plain count. */
function hintFor(o: Op, operand: Token | undefined, fmt?: LengthFormat): UnitId | null {
	if (o !== '+' && o !== '−' || !operand) return null;
	if (operand.kind === 'entry') return unitOf(operand.entry);
	if (operand.kind === 'value') {
		const d = operand.value.d;
		if (d === 0) return null;
		if (fmt && fmt !== 'ftin' && UNITS[fmt as UnitId]?.d === d) return fmt as UnitId;
		if (fmt === 'in' && d === 1) return 'in';
		return d === 2 ? 'sqft' : d === 3 ? 'cuft' : null;
	}
	return null;
}

/** Whether `operand` is a length (a bare fraction added to it is inches). */
function isLength(operand: Token | undefined): boolean {
	if (operand?.kind === 'value') return operand.value.d === 1;
	if (operand?.kind === 'entry') return entryValue(operand.entry)?.d === 1;
	return false;
}

const nextEntry = (o: Op, operand: Token | undefined, fmt?: LengthFormat): Token => ({
	kind: 'entry',
	entry: { ...emptyEntry(), hint: hintFor(o, operand, fmt), fracIn: (o === '+' || o === '−') && isLength(operand) }
});

/** `fmt`: how the answer is shown now, so carrying it on keeps that unit. */
export function op(s: CalcState, o: Op, den: number, fmt?: LengthFormat): CalcState {
	if (s.done) {
		const value: Token = { kind: 'value', value: s.done, text: valueText(s.done, den, fmt) };
		return { ...s, tokens: [value, { kind: 'op', op: o }, nextEntry(o, value, fmt)], done: null, error: null };
	}
	const tokens = [...s.tokens];
	const last = tokens[tokens.length - 1];
	if (last.kind === 'entry' && isEmpty(last.entry)) {
		// Change the operator just typed (and what it suggests); nothing to
		// apply it to otherwise.
		const prev = tokens[tokens.length - 2];
		if (prev?.kind === 'op') {
			tokens[tokens.length - 2] = { kind: 'op', op: o };
			tokens[tokens.length - 1] = nextEntry(o, tokens[tokens.length - 3]);
			return { ...s, tokens, error: null };
		}
		return s;
	}
	return { ...s, tokens: [...tokens, { kind: 'op', op: o }, nextEntry(o, last)], error: null };
}

export function equals(s: CalcState): CalcState {
	if (s.done) return s;
	try {
		const result = evaluate(s.tokens);
		if (!result) return s;
		const expr = exprText(s) + ')'.repeat(openParens(s.tokens));
		const tape = [{ expr, result, at: Date.now() }, ...s.tape].slice(0, TAPE_MAX);
		return { ...s, done: result, tape, error: null };
	} catch (e) {
		if (e instanceof CalcError) return { ...s, error: e.message };
		throw e;
	}
}

export function back(s: CalcState): CalcState {
	if (s.done) return { ...s, done: null };
	const tokens = [...s.tokens];
	const last = tokens[tokens.length - 1];
	if (last.kind === 'entry' && !isEmpty(last.entry)) return setCurrent(s, backspace(last.entry));
	if (last.kind === 'value') {
		tokens[tokens.length - 1] = { kind: 'entry', entry: emptyEntry() };
		return { ...s, tokens, error: null };
	}
	if (last.kind === 'paren') return { ...s, tokens: tokens.slice(0, -1), error: null };
	// Empty entry: drop it and the operator or "(" before it.
	if (tokens.length < 2) return s;
	const rest = tokens.slice(0, -2);
	const end = rest[rest.length - 1];
	if (!end || end.kind === 'op' || (end.kind === 'paren' && end.p === '(')) rest.push({ kind: 'entry', entry: emptyEntry() });
	return { ...s, tokens: rest, error: null };
}

export function clear(s: CalcState): CalcState {
	return { ...initialState(), tape: s.tape, vars: s.vars };
}

/** Store the answer under a letter; an unfinished formula is finished
 *  first (as if = was pressed). */
export function storeVar(s: CalcState, name: VarName): CalcState {
	const done = s.done ? s : equals(s);
	if (!done.done) return done;
	return { ...done, vars: { ...(done.vars ?? {}), [name]: done.done } };
}

export function clearVar(s: CalcState, name: VarName): CalcState {
	const vars = { ...(s.vars ?? {}) };
	delete vars[name];
	return { ...s, vars };
}

/** Put a stored letter into the formula. Right after a number or ")" it
 *  multiplies (2A = 2 × A); after an answer it starts a new formula. */
export function useVar(s: CalcState, name: VarName): CalcState {
	const v = s.vars?.[name];
	if (!v) return s;
	const token: Token = { kind: 'value', value: v, text: name };
	if (s.done) return { ...s, tokens: [token], done: null, error: null };
	const last = s.tokens[s.tokens.length - 1];
	if (last.kind === 'entry' && isEmpty(last.entry)) return { ...s, tokens: [...s.tokens.slice(0, -1), token], error: null };
	return { ...s, tokens: [...s.tokens, { kind: 'op', op: '×' }, token], error: null };
}

/** Put a value (from the tape or a conversion) in as the current number. */
export function insert(s: CalcState, v: Quantity, den: number): CalcState {
	const base = s.done ? { ...s, tokens: [{ kind: 'entry', entry: emptyEntry() } as Token], done: null } : s;
	const tokens = [...base.tokens];
	tokens[tokens.length - 1] = { kind: 'value', value: v, text: valueText(v, den) };
	return { ...base, tokens, error: null };
}

export function exprText(s: CalcState): string {
	return tokensText(s.tokens);
}

/** The live value: the finished result, else the expression so far. */
export function live(s: CalcState): { value: Quantity | null; error: string | null } {
	if (s.done) return { value: s.done, error: null };
	try {
		return { value: evaluate(s.tokens), error: s.error };
	} catch (e) {
		if (e instanceof CalcError) return { value: null, error: e.message };
		throw e;
	}
}


export type Fn = 'sq' | 'cube' | 'sqrt' | 'neg';

/** One-value functions on the number being typed (or the last answer):
 *  x² doubles the dimension (a length squared is an area), x³ triples it
 *  (a length cubed is a volume), √ halves it (an area's root is a length),
 *  ± flips the sign. */
export function fn(s: CalcState, f: Fn, den: number, fmt?: LengthFormat): CalcState {
	const fromDone = s.done !== null;
	const last = s.tokens[s.tokens.length - 1];
	// On ")": the whole group, (3′ + 4′)².
	let from = s.tokens.length - 1;
	if (!fromDone && last.kind === 'paren' && last.p === ')') {
		let depth = 0;
		for (let i = s.tokens.length - 1; i >= 0; i--) {
			const t = s.tokens[i];
			if (t.kind === 'paren') depth += t.p === ')' ? 1 : -1;
			if (depth === 0) {
				from = i;
				break;
			}
		}
	}
	let x: Quantity | null;
	let text: string;
	try {
		x = fromDone ? s.done : last.kind === 'paren' ? evaluate(s.tokens.slice(from)) : last.kind === 'entry' ? entryValue(last.entry) : last.kind === 'value' ? last.value : null;
	} catch (e) {
		if (e instanceof CalcError) return { ...s, error: e.message };
		throw e;
	}
	if (!x) return s;
	if (fromDone) text = valueText(x, den, fmt);
	else if (last.kind === 'paren') text = tokensText(s.tokens.slice(from + 1, -1));
	else text = tokenText(last);
	let v: Quantity;
	let label: string;
	try {
		if (f === 'sq') {
			if (x.d * 2 > 3) throw new CalcError('Beyond volume');
			v = { v: x.v * x.v, d: (x.d * 2) as Dim };
			label = `(${text})²`;
		} else if (f === 'cube') {
			if (x.d * 3 > 3) throw new CalcError('Beyond volume');
			v = { v: x.v * x.v * x.v, d: (x.d * 3) as Dim };
			label = `(${text})³`;
		} else if (f === 'sqrt') {
			if (x.v < 0) throw new CalcError("Can't take the root of a negative");
			if (x.d % 2) throw new CalcError(x.d === 1 ? 'Root of a length has no unit' : 'Root of a volume has no unit');
			v = { v: Math.sqrt(x.v), d: (x.d / 2) as Dim };
			label = `√(${text})`;
		} else {
			v = { v: -x.v, d: x.d };
			label = `−(${text})`;
		}
	} catch (e) {
		if (e instanceof CalcError) return { ...s, error: e.message };
		throw e;
	}
	if (fromDone) {
		const tape = [{ expr: label, result: v, at: Date.now() }, ...s.tape].slice(0, TAPE_MAX);
		return { ...s, tokens: [{ kind: 'value', value: v, text: label }], done: v, tape, error: null };
	}
	return { ...s, tokens: [...s.tokens.slice(0, from), { kind: 'value', value: v, text: label }], error: null };
}

/** π as the current number. */
export function pi(s: CalcState): CalcState {
	const base = s.done ? { ...s, tokens: [{ kind: 'entry', entry: emptyEntry() } as Token], done: null } : s;
	const tokens = [...base.tokens];
	tokens[tokens.length - 1] = { kind: 'value', value: { v: Math.PI, d: 0 }, text: 'π' };
	return { ...base, tokens, error: null };
}

/** Paste text: a value (8' 4 1/2", 12 ft, 3.5 m) goes in as the current
 *  number; anything else is read as a formula (12' + 4' 6" x 2). What isn't
 *  a number, a unit or an operator ($, °, words, thousands commas) is left
 *  out, so whatever numbers there are always get in. */
export function paste(s: CalcState, text: string, den: number, fmt?: LengthFormat): CalcState {
	const whole = parseText(text);
	if (whole) return put(s, whole, text.trim(), den);
	const t = text
		.toLowerCase()
		.replace(/[′’‘]/g, "'")
		.replace(/[″”“]/g, '"')
		.replace(/⁄/g, '/')
		.replace(/[−–—]/g, '-')
		.replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
		.replace(/(\d)\s*(?:feet|foot|ft)(?![a-z])/g, "$1'")
		.replace(/(\d)\s*(?:inches|inch|in)(?![a-z])/g, '$1"')
		.replace(/([\d'")])\s*[x×*]\s*(?=[\d.(])/g, '$1 × ')
		.replace(/÷/g, ' ÷ ')
		// 5'-6" and 6-1/2 are one number, not a subtraction.
		.replace(/'\s*-\s*(?=\d)/g, "' ")
		.replace(/(\d)-(?=\d+\/\d)/g, '$1 ')
		.replace(/[^0-9.'"/+\-×÷()\s]/g, ' ');
	// Operators and parentheses split the text; "/" with spaces around it
	// divides, inside a number it is a fraction.
	const parts = t.split(/(\s\/\s|[+\-×÷()])/).map((p) => p.trim()).filter(Boolean);
	let out = s;
	let neg = false;
	let expectOperand = true;
	for (const p of parts) {
		if (p === '(' || p === ')') {
			out = paren(out, p, den, fmt);
			expectOperand = p === '(';
			continue;
		}
		if (p === '-' && expectOperand) {
			neg = !neg;
			continue;
		}
		if (p === '+' || p === '-' || p === '×' || p === '÷' || p === '/') {
			const o: Op = p === '+' ? '+' : p === '-' ? '−' : p === '/' ? '÷' : (p as Op);
			out = op(out, o, den, fmt);
			expectOperand = true;
			continue;
		}
		const v = operand(p);
		if (!v) continue;
		if (!expectOperand && hasOperand(out)) out = op(out, '×', den, fmt);
		out = put(out, neg ? { v: -v.v, d: v.d } : v, p, den);
		neg = false;
		expectOperand = false;
	}
	return out;
}

/** A pasted piece as a value: 5' 3 1/2", 3/4, 12; the first number in it
 *  when it doesn't read as one (two numbers side by side). */
function operand(p: string): Quantity | null {
	const v = parseText(p);
	if (v) return v;
	const n = p.match(/\d*\.?\d+/);
	return n ? { v: Number(n[0]), d: 0 } : null;
}

/** Put a pasted number in. A plain number is typed key by key, so it takes
 *  the unit the calculator suggests (12' + 4 is 12' + 4', 12' + 3/4 is
 *  12' 3/4"); a mixed one next to a length is inches. */
function put(s: CalcState, v: Quantity, text: string, den: number): CalcState {
	if (v.d === 0 && v.v >= 0 && /^(?:\d*\.?\d+|\d+\/\d+)$/.test(text)) {
		let out = s;
		for (const ch of text) out = key(out, ch === '/' ? 'frac' : (ch as EntryKey));
		return out;
	}
	const e = s.done ? null : current(s);
	if (v.d === 0 && e && (e.fracIn || e.hint === 'in') && /\//.test(text)) return insert(s, { v: v.v, d: 1 }, den);
	return insert(s, v, den);
}
