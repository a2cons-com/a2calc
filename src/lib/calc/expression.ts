// The expression on the display: values and operators, evaluated with the
// usual precedence (× ÷ before + −) and dimension rules:
//   + −  same kind only (a length plus a length); a plain number can't be
//        added to a length -- there's no telling if it meant feet or inches
//   ×    dimensions add (length × length = area, area × length = volume)
//   ÷    dimensions subtract (volume ÷ area = length, length ÷ length = a
//        plain ratio); dividing by more than you have is an error

import { entryValue, formatEntry, type Entry } from './entry';
import { DIM_NAME, type Dim, type Quantity } from './units';

export type Op = '+' | '−' | '×' | '÷';

export type Token = { kind: 'entry'; entry: Entry } | { kind: 'value'; value: Quantity; text: string } | { kind: 'op'; op: Op };

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

/** Evaluate; a trailing operator or empty entry is ignored (so a live
 *  preview works while typing). Returns null when there is nothing. */
export function evaluate(tokens: Token[]): Quantity | null {
	const items = [...tokens];
	while (items.length) {
		const last = items[items.length - 1];
		if (last.kind === 'op' || (last.kind === 'entry' && entryValue(last.entry) === null)) items.pop();
		else break;
	}
	if (!items.length) return null;
	const values: Quantity[] = [];
	const ops: Op[] = [];
	const reduce = () => {
		const b = values.pop()!;
		const a = values.pop()!;
		values.push(apply(a, ops.pop()!, b));
	};
	for (const t of items) {
		if (t.kind === 'op') {
			while (ops.length && PREC[ops[ops.length - 1]] >= PREC[t.op]) reduce();
			ops.push(t.op);
		} else {
			const v = tokenValue(t);
			if (v === null) throw new CalcError('Incomplete entry');
			values.push(v);
		}
	}
	while (ops.length) reduce();
	return values[0];
}

export function tokenText(t: Token): string {
	if (t.kind === 'op') return t.op;
	if (t.kind === 'value') return t.text;
	return formatEntry(t.entry);
}
