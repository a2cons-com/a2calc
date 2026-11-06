// The expression on the display: values, operators and parentheses,
// evaluated with the usual precedence (parentheses first, then × ÷, then
// + −) and dimension rules:
//   + −  same kind only (a length plus a length); a plain number can't be
//        added to a length -- there's no telling if it meant feet or inches
//   ×    dimensions add (length × length = area, area × length = volume)
//   ÷    dimensions subtract (volume ÷ area = length, length ÷ length = a
//        plain ratio); dividing by more than you have is an error

import { entryValue, formatEntry, type Entry } from './entry';
import { DIM_NAME, type Dim, type Quantity } from './units';

export type Op = '+' | '−' | '×' | '÷';

export type Token =
	| { kind: 'entry'; entry: Entry }
	| { kind: 'value'; value: Quantity; text: string }
	| { kind: 'op'; op: Op }
	| { kind: 'paren'; p: '(' | ')' };

export class CalcError extends Error {}

const PREC: Record<Op, number> = { '+': 1, '−': 1, '×': 2, '÷': 2 };

export function apply(a: Quantity, op: Op, b: Quantity): Quantity {
	switch (op) {
		case '+':
		case '−':
			if (a.d !== b.d) {
				if (a.d === 0 || b.d === 0) throw new CalcError('Add ′ or ″ to the plain number');
				throw new CalcError(`Can't mix ${DIM_NAME[a.d].toLowerCase()} and ${DIM_NAME[b.d].toLowerCase()}`);
			}
			return { v: op === '+' ? a.v + b.v : a.v - b.v, d: a.d };
		case '×': {
			const d = a.d + b.d;
			if (d > 3) throw new CalcError('Beyond volume');
			return { v: a.v * b.v, d: d as Dim };
		}
		case '÷': {
			const d = a.d - b.d;
			if (d < 0) throw new CalcError(`Can't divide by a bigger unit`);
			if (b.v === 0) throw new CalcError("Can't divide by zero");
			return { v: a.v / b.v, d: d as Dim };
		}
	}
}

function tokenValue(t: Token): Quantity | null {
	if (t.kind === 'entry') return entryValue(t.entry);
	if (t.kind === 'value') return t.value;
	return null;
}

/** Evaluate. A trailing operator, empty entry or open parenthesis is
 *  ignored, and parentheses left open close at the end, so a half-typed
 *  formula can still be finished with '='. Returns null when empty. */
export function evaluate(tokens: Token[]): Quantity | null {
	const items = [...tokens];
	const dangling = (t: Token) => t.kind === 'op' || (t.kind === 'paren' && t.p === '(') || (t.kind === 'entry' && entryValue(t.entry) === null);
	while (items.length && dangling(items[items.length - 1])) items.pop();
	if (!items.length) return null;
	const values: Quantity[] = [];
	const ops: (Op | '(')[] = [];
	const reduce = () => {
		const b = values.pop();
		const a = values.pop();
		const o = ops.pop() as Op;
		if (!a || !b) throw new CalcError('Incomplete formula');
		values.push(apply(a, o, b));
	};
	for (const t of items) {
		if (t.kind === 'paren') {
			if (t.p === '(') ops.push('(');
			else {
				while (ops.length && ops[ops.length - 1] !== '(') reduce();
				if (!ops.length) throw new CalcError('Unmatched )');
				ops.pop();
			}
		} else if (t.kind === 'op') {
			while (ops.length && ops[ops.length - 1] !== '(' && PREC[ops[ops.length - 1] as Op] >= PREC[t.op]) reduce();
			ops.push(t.op);
		} else {
			const v = tokenValue(t);
			if (v === null) continue;
			values.push(v);
		}
	}
	while (ops.length) {
		if (ops[ops.length - 1] === '(') ops.pop();
		else reduce();
	}
	if (values.length !== 1) throw new CalcError('Incomplete formula');
	return values[0];
}

/** How many parentheses are open at the end. */
export function openParens(tokens: Token[]): number {
	let n = 0;
	for (const t of tokens) if (t.kind === 'paren') n += t.p === '(' ? 1 : -1;
	return Math.max(0, n);
}

/** The formula as text: 2 × (5′ + 3′). */
export function tokensText(tokens: Token[]): string {
	let out = '';
	for (const t of tokens) {
		const text = tokenText(t);
		if (!text) continue;
		const tight = (t.kind === 'paren' && t.p === ')') || out.endsWith('(') || out === '';
		out += (tight ? '' : ' ') + text;
	}
	return out;
}

export function tokenText(t: Token): string {
	if (t.kind === 'op') return t.op;
	if (t.kind === 'paren') return t.p;
	if (t.kind === 'value') return t.text;
	return formatEntry(t.entry);
}
