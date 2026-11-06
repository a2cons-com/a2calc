// The basic calculator's state machine, kept free of UI so it can be
// tested: keys go in, the expression / live result / tape come out.

import { backspace, canPress, emptyEntry, isEmpty, press, type Entry, type EntryKey } from './entry';
import { CalcError, evaluate, tokenText, type Op, type Token } from './expression';
import { formatAs, defaultFormat, type LengthFormat, type Quantity, type UnitId } from './units';

export interface TapeLine {
	expr: string;
	result: Quantity;
	at: number;
}

export interface CalcState {
	tokens: Token[];
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
	const e = current(s);
	if (!e) {
		// After a reused value: typing replaces it.
		const tokens = s.tokens.slice(0, -1);
		return { ...s, tokens: [...tokens, { kind: 'entry', entry: press(emptyEntry(), k) }], error: null };
	}
	return setCurrent(s, press(e, k));
}

/** Tag the current entry with a unit (sq ft, cu yd, m...). */
export function unit(s: CalcState, u: UnitId): CalcState {
	if (s.done) return s;
	const e = current(s);
	if (!e || /['"]/.test(e.raw) || e.raw === '') return s;
	return setCurrent(s, { ...e, unit: u });
}

export function op(s: CalcState, o: Op, den: number): CalcState {
	if (s.done) {
		return { ...s, tokens: [{ kind: 'value', value: s.done, text: valueText(s.done, den) }, { kind: 'op', op: o }, { kind: 'entry', entry: emptyEntry() }], done: null, error: null };
	}
	const tokens = [...s.tokens];
	const last = tokens[tokens.length - 1];
	if (last.kind === 'entry' && isEmpty(last.entry)) {
		// Change the operator just typed, or start a negative number.
		const prev = tokens[tokens.length - 2];
		if (prev?.kind === 'op') {
			tokens[tokens.length - 2] = { kind: 'op', op: o };
			return { ...s, tokens, error: null };
		}
		if (tokens.length === 1) return s;
	}
	return { ...s, tokens: [...tokens, { kind: 'op', op: o }, { kind: 'entry', entry: emptyEntry() }], error: null };
}

export function equals(s: CalcState): CalcState {
	if (s.done) return s;
	try {
		const result = evaluate(s.tokens);
		if (!result) return s;
		const expr = exprText(s);
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
	// Empty entry: drop it and the operator before it.
	if (tokens.length >= 3) return { ...s, tokens: tokens.slice(0, -2), error: null };
	return s;
}

export function clear(s: CalcState): CalcState {
	return { ...initialState(), tape: s.tape };
}

/** Put a value (from the tape or a conversion) in as the current number. */
export function insert(s: CalcState, v: Quantity, den: number): CalcState {
	const base = s.done ? { ...s, tokens: [{ kind: 'entry', entry: emptyEntry() } as Token], done: null } : s;
	const tokens = [...base.tokens];
	tokens[tokens.length - 1] = { kind: 'value', value: v, text: valueText(v, den) };
	return { ...base, tokens, error: null };
}

export function exprText(s: CalcState): string {
	return s.tokens
		.map(tokenText)
		.filter((t) => t !== '')
		.join(' ');
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

