import { describe, expect, it } from 'vitest';
import { canPress, emptyEntry, entryValue, formatEntry, parseText, press, backspace, type Entry, type EntryKey } from './entry';
import { evaluate, CalcError } from './expression';
import { formatAs, formatFtIn, fromUnit, nextFormat, toUnit, splitFtIn } from './units';
import * as C from './calculator';

const type = (keys: string): Entry => {
	let e = emptyEntry();
	for (const ch of keys) {
		const k = (ch === "'" ? 'ft' : ch === '"' ? 'in' : ch === '/' ? 'frac' : ch) as EntryKey;
		e = press(e, k);
	}
	return e;
};

describe('entry', () => {
	it('reads feet, inches and fractions', () => {
		expect(entryValue(type("5'"))).toEqual({ v: 60, d: 1 });
		expect(entryValue(type("5'3"))).toEqual({ v: 63, d: 1 });
		expect(entryValue(type(`5'3"1/2`))).toEqual({ v: 63.5, d: 1 });
		expect(entryValue(type(`3"1/2`))).toEqual({ v: 3.5, d: 1 });
		expect(entryValue(type(`3/4"`))).toEqual({ v: 0.75, d: 1 });
		expect(entryValue(type("5'3/8"))).toEqual({ v: 60.375, d: 1 });
		expect(entryValue(type('3/4'))).toEqual({ v: 0.75, d: 0 });
		expect(entryValue(type("12.5'"))).toEqual({ v: 150, d: 1 });
		expect(entryValue(type('42'))).toEqual({ v: 42, d: 0 });
	});
	it('formats as typed', () => {
		expect(formatEntry(type(`5'3"1/2`))).toBe('5′ 3 1/2″');
		expect(formatEntry(type("5'3"))).toBe('5′ 3');
		expect(formatEntry(type(`5'3"1/`))).toBe('5′ 3 1/″');
		expect(formatEntry(type('3/4'))).toBe('3/4');
	});
	it('refuses keys that make no sense', () => {
		expect(canPress(emptyEntry(), 'ft')).toBe(false);
		expect(canPress(type("5'"), 'ft')).toBe(true); // cycles to sq ft
		expect(canPress(type("5'"), 'ft', false)).toBe(false);
		expect(canPress(type('3/'), 'in')).toBe(false);
		expect(canPress(type('3/4'), 'in')).toBe(true);
		expect(canPress(type('3/4'), 'frac')).toBe(false);
		expect(canPress(type('3.5'), 'frac')).toBe(false);
		expect(canPress(type(`3"`), '.')).toBe(false);
		expect(canPress(type(`3/4"`), '5')).toBe(false);
	});
	it('cycles feet and inches through square and cubic', () => {
		let e = type("5'");
		e = press(e, 'ft');
		expect(entryValue(e)).toEqual({ v: 5 * 144, d: 2 });
		expect(formatEntry(e)).toBe('5 sq ft');
		e = press(e, 'ft');
		expect(entryValue(e)).toEqual({ v: 5 * 1728, d: 3 });
		e = press(e, 'ft');
		expect(entryValue(e)).toEqual({ v: 60, d: 1 });
		let i = press(type('3/4"'), 'in');
		expect(entryValue(i)).toEqual({ v: 0.75, d: 2 });
		i = press(i, 'in');
		expect(formatEntry(i)).toBe('3/4 cu in');
		// feet and inches together don't cycle; a length field doesn't either
		expect(canPress(type(`5'3"`), 'ft')).toBe(false);
		expect(press(type("5'"), 'ft', false).raw).toBe("5'");
	});
	it('backspaces one keystroke', () => {
		expect(backspace(type(`5'3"`)).raw).toBe("5'3");
		expect(press(emptyEntry(), '.').raw).toBe('0.');
	});
	it('parses typed text', () => {
		expect(parseText(`12' 6 1/2"`)).toEqual({ v: 150.5, d: 1 });
		expect(parseText(`12'-6"`)).toEqual({ v: 150, d: 1 });
		expect(parseText('6-1/2"')).toEqual({ v: 6.5, d: 1 });
		expect(parseText('3.5 ft')).toEqual({ v: 42, d: 1 });
		expect(parseText('120 sq ft')).toEqual({ v: 120 * 144, d: 2 });
		expect(parseText('2 cu yd')).toEqual({ v: 2 * 46656, d: 3 });
		expect(parseText('7')).toEqual({ v: 7, d: 0 });
		expect(parseText('abc')).toBeNull();
	});
});

describe('formatting', () => {
	it('rounds to the precision and reduces', () => {
		expect(formatFtIn(63.5, 16)).toBe('5′ 3 1/2″');
		expect(formatFtIn(60, 16)).toBe('5′');
		expect(formatFtIn(0.75, 16)).toBe('3/4″');
		expect(formatFtIn(0, 16)).toBe('0″');
		expect(formatFtIn(63.5, 16, true)).toBe('63 1/2″');
		expect(formatFtIn(-14.25, 16)).toBe('−1′ 2 1/4″');
		// 1/3" at 1/16 rounds to 5/16; 11.99" rounds up to a whole foot
		expect(formatFtIn(1 / 3, 16)).toBe('5/16″');
		expect(splitFtIn(1 / 3, 16).rounded).toBe(true);
		expect(formatFtIn(11.99, 16)).toBe('1′');
	});
	it('shows lengths as decimal feet and decimal inches, and steps formats', () => {
		expect(formatAs({ v: 98.25, d: 1 }, 'ft', 16).text).toBe('8.1875′');
		expect(formatAs({ v: 98.25, d: 1 }, 'indec', 16).text).toBe('98.25″');
		expect(formatAs({ v: 98.25, d: 1 }, 'in', 16).text).toBe('98 1/4″');
		expect(nextFormat(1, 'ft', 'ftin')).toBe('ft');
		expect(nextFormat(1, 'ft', 'ft')).toBe('ftin');
		expect(nextFormat(1, 'in', 'ftin')).toBe('in');
		expect(nextFormat(1, 'in', 'in')).toBe('indec');
		expect(nextFormat(3, 'ft', 'cuft')).toBe('cuyd');
		expect(nextFormat(2, 'in', 'sqft')).toBe('sqin');
	});
	it('converts units both ways', () => {
		expect(toUnit(fromUnit(1, 'cuyd'), 'cuft')).toBeCloseTo(27);
		expect(toUnit(fromUnit(1, 'm'), 'in')).toBeCloseTo(39.3701, 4);
		expect(toUnit(fromUnit(1, 'sqyd'), 'sqft')).toBeCloseTo(9);
		expect(formatAs({ v: 144 * 100, d: 2 }, 'sqft', 16).text).toBe('100 sq ft');
		expect(formatAs({ v: 1728 * 27, d: 3 }, 'cuyd', 16).text).toBe('1 cu yd');
	});
});

describe('expression', () => {
	const e = (raw: string) => ({ kind: 'entry' as const, entry: type(raw) });
	it('keeps dimensions straight', () => {
		// 10' × 12' = 120 sq ft
		const area = evaluate([e("10'"), { kind: 'op', op: '×' }, e("12'")])!;
		expect(area.d).toBe(2);
		expect(toUnit(area, 'sqft')).toBeCloseTo(120);
		// × 4" = 40 cu ft
		const vol = evaluate([e("10'"), { kind: 'op', op: '×' }, e("12'"), { kind: 'op', op: '×' }, e('4"')])!;
		expect(toUnit(vol, 'cuft')).toBeCloseTo(40);
		// 8' ÷ 16" = 6 (a ratio)
		expect(evaluate([e("8'"), { kind: 'op', op: '÷' }, e('16"')])).toEqual({ v: 6, d: 0 });
	});
	it('uses precedence', () => {
		// 1' + 2' × 3 = 7'
		expect(evaluate([e("1'"), { kind: 'op', op: '+' }, e("2'"), { kind: 'op', op: '×' }, e('3')])).toEqual({ v: 84, d: 1 });
	});
	it('refuses a length plus a plain number', () => {
		expect(() => evaluate([e("5'"), { kind: 'op', op: '+' }, e('3')])).toThrow(CalcError);
	});
});

describe('calculator', () => {
	const keys = (s: C.CalcState, seq: string) => {
		for (const ch of seq) {
			if ('+−×÷'.includes(ch)) s = C.op(s, ch as '+', 16);
			else if (ch === '=') s = C.equals(s);
			else s = C.key(s, (ch === "'" ? 'ft' : ch === '"' ? 'in' : ch === '/' ? 'frac' : ch) as EntryKey);
		}
		return s;
	};
	it('adds feet-inch-fractions and writes the tape', () => {
		const s = keys(C.initialState(), `5'3"1/2+2'10"3/4=`);
		expect(s.done).toEqual({ v: 98.25, d: 1 });
		expect(formatAs(s.done!, 'ftin', 16).text).toBe('8′ 2 1/4″');
		expect(s.tape[0].expr).toBe('5′ 3 1/2″ + 2′ 10 3/4″');
	});
	it('continues from a result', () => {
		let s = keys(C.initialState(), `10'×12'=`);
		s = keys(s, `×4"=`);
		expect(toUnit(s.done!, 'cuft')).toBeCloseTo(40);
		expect(s.tape).toHaveLength(2);
	});
	it('replaces a repeated operator and shows errors', () => {
		let s = keys(C.initialState(), `5'+×2`);
		expect(C.exprText(s)).toBe('5′ × 2');
		// 5' + 3 now means 3 feet (the unit carries over after +)
		expect(keys(C.initialState(), `5'+3=`).done).toEqual({ v: 96, d: 1 });
		// a length plus an area is still refused
		s = C.equals(C.unit(keys(C.initialState(), `5'+3`), 'sqft'));
		expect(s.error).toMatch(/Can't mix/);
	});
	it('backspaces through operators', () => {
		let s = keys(C.initialState(), `5'+`);
		s = C.back(s);
		expect(C.exprText(s)).toBe('5′');
	});
	it('squares and roots with units', () => {
		let s = keys(C.initialState(), `12'`);
		s = C.fn(s, 'sq', 16);
		s = C.equals(s);
		expect(toUnit(s.done!, 'sqft')).toBeCloseTo(144);
		s = C.fn(s, 'sqrt', 16);
		expect(s.done).toEqual({ v: 144, d: 1 });
		expect(s.tape[0].expr).toBe('√(144 sq ft)');
		expect(C.fn(keys(C.initialState(), `5'`), 'sqrt', 16).error).toMatch(/no unit/);
		// diagonal of a 3' × 4' corner: √(3'² + 4'²) = 5'
		let d = C.fn(keys(C.initialState(), `3'`), 'sq', 16);
		d = keys(d, `+4'`);
		d = C.fn(d, 'sq', 16);
		d = C.equals(d);
		d = C.fn(d, 'sqrt', 16);
		expect(d.done).toEqual({ v: 60, d: 1 });
	});
	it('uses parentheses and precedence', () => {
		// 2' + 3' × 2 = 8' ; (2' + 3') × 2 = 10'
		expect(keys(C.initialState(), `2'+3'×2=`).done).toEqual({ v: 96, d: 1 });
		let s = C.paren(C.initialState(), '(', 16);
		s = keys(s, `2'+3'`);
		s = C.paren(s, ')', 16);
		s = keys(s, '×2=');
		expect(s.done).toEqual({ v: 120, d: 1 });
		expect(s.tape[0].expr).toBe('(2′ + 3′) × 2');
	});
	it('closes open parentheses at = and multiplies next to them', () => {
		let s = keys(C.initialState(), '2');
		s = C.paren(s, '(', 16); // 2 × (
		s = keys(s, `3'+1'=`);
		expect(s.done).toEqual({ v: 96, d: 1 });
		expect(s.tape[0].expr).toBe('2 × (3′ + 1′)');
		expect(C.canParen(keys(C.initialState(), '2'), ')')).toBe(false);
	});
	it('squares a whole group', () => {
		let s = C.paren(C.initialState(), '(', 16);
		s = keys(s, `3'+4'`);
		s = C.paren(s, ')', 16);
		s = C.equals(C.fn(s, 'sq', 16));
		expect(toUnit(s.done!, 'sqft')).toBeCloseTo(49);
	});
	it('backspaces through parentheses', () => {
		let s = keys(C.initialState(), '5+');
		s = C.paren(s, '(', 16);
		expect(C.exprText(s)).toBe('5 + (');
		s = C.back(s);
		expect(C.exprText(s)).toBe('5 +');
		s = keys(s, '3');
		expect(C.equals(s).done).toEqual({ v: 8, d: 0 });
	});
	it('gives a plain answer a unit and carries the shown unit on', () => {
		let s = keys(C.initialState(), '10×12=');
		s = C.unit(s, 'sqft');
		expect(toUnit(s.done!, 'sqft')).toBeCloseTo(120);
		expect(s.tape[0].expr).toBe('10 × 12 → sq ft');
		let v = keys(C.initialState(), '54');
		v = C.equals(C.unit(v, 'cuft'));
		v = C.op(v, '×', 16, 'cuyd');
		expect(C.exprText(v)).toBe('2 cu yd ×');
	});
	it('stores answers in letters and uses them', () => {
		let s = keys(C.initialState(), `12'3"=`);
		s = C.storeVar(s, 'A');
		s = keys(s, `2'+`); // a new formula
		s = C.storeVar(C.equals(keys(C.initialState(), `4'=`)), 'B');
		let f = C.useVar({ ...s, vars: { A: { v: 147, d: 1 }, B: { v: 48, d: 1 } } }, 'A');
		f = keys(f, '×2+');
		f = C.useVar(f, 'B');
		expect(C.exprText(f)).toBe('A × 2 + B');
		expect(C.equals(f).done).toEqual({ v: 342, d: 1 });
		// unfinished formula: store finishes it
		const g = C.storeVar(keys(C.initialState(), `1'+1'`), 'C');
		expect(g.vars?.C).toEqual({ v: 24, d: 1 });
		expect(C.clear(g).vars?.C).toEqual({ v: 24, d: 1 });
	});
	it('sets a power from the long-press menu', () => {
		let s = keys(C.initialState(), '12');
		expect(C.canPower(s)).toBe(true);
		s = C.power(s, 'ft', 3);
		expect(toUnit(C.equals(s).done!, 'cuft')).toBeCloseTo(12);
		s = C.power(keys(C.initialState(), `4'`), 'in', 2);
		expect(C.equals(s).done).toEqual({ v: 4, d: 2 });
		expect(C.canPower(keys(C.initialState(), `5'3`))).toBe(false);
	});
	it('suggests the unit of the number before after + and −', () => {
		// 5 cu ft + 3 -> 3 cu ft
		let s = C.power(keys(C.initialState(), '5'), 'ft', 3);
		s = keys(s, '+3');
		expect(C.exprText(s)).toBe('5 cu ft + 3 cu ft');
		expect(toUnit(C.equals(s).done!, 'cuft')).toBeCloseTo(8);
		// 12' + 4 -> 4'; 12' + 4" is still inches
		expect(C.equals(keys(C.initialState(), `12'+4`)).done).toEqual({ v: 192, d: 1 });
		expect(C.equals(keys(C.initialState(), `12'+4"`)).done).toEqual({ v: 148, d: 1 });
		expect(C.exprText(keys(C.initialState(), `12'+4"`))).toBe('12′ + 4″');
		// x and / keep plain numbers
		expect(C.equals(keys(C.initialState(), `12'×3`)).done).toEqual({ v: 432, d: 1 });
		// backspace keeps the unit until the digits are gone
		let b = keys(C.initialState(), `12'+45`);
		b = C.back(b);
		expect(C.exprText(b)).toBe('12′ + 4′');
		b = C.back(C.back(b));
		expect(C.exprText(b)).toBe('12′');
		// changing + to x drops the suggestion
		const x = keys(C.initialState(), `12'+×3`);
		expect(C.exprText(x)).toBe('12′ × 3');
		// after an answer shown in cu yd, + suggests cu yd
		let r = C.equals(C.power(keys(C.initialState(), '27'), 'ft', 3));
		r = C.op(r, '+', 16, 'cuyd');
		r = keys(r, '1=');
		expect(toUnit(r.done!, 'cuyd')).toBeCloseTo(2);
	});
	it('cubes a length into a volume', () => {
		const s = C.equals(C.fn(keys(C.initialState(), `3'`), 'cube', 16));
		expect(toUnit(s.done!, 'cuyd')).toBeCloseTo(1);
		expect(C.fn(keys(C.initialState(), `3'×3'=`), 'cube', 16).error).toMatch(/Beyond volume/);
	});
	it('negates and inserts pi', () => {
		const s = C.equals(C.fn(keys(C.initialState(), `2'`), 'neg', 16));
		expect(s.done).toEqual({ v: -24, d: 1 });
		const p = keys(C.pi(C.initialState()), `×2=`);
		expect(p.done!.v).toBeCloseTo(2 * Math.PI);
	});
});

describe('fractions next to lengths', () => {
	const keys = (s: C.CalcState, ks: string) => {
		for (const k of ks.split(' ')) {
			if (k === '+' || k === '−' || k === '×') s = C.op(s, k, 16);
			else if (k === '=') s = C.equals(s);
			else s = C.key(s, k as EntryKey);
		}
		return s;
	};
	it('a bare fraction added to feet is inches', () => {
		expect(keys(C.initialState(), `1 2 ft + 3 frac 4 =`).done).toEqual({ v: 144.75, d: 1 });
	});
	it('a bare fraction added to feet-inches is inches', () => {
		expect(keys(C.initialState(), `5 ft 3 in + 1 frac 4 =`).done).toEqual({ v: 63.25, d: 1 });
	});
	it('a whole number after + still takes the feet', () => {
		expect(keys(C.initialState(), `1 2 ft + 4 =`).done).toEqual({ v: 192, d: 1 });
	});
	it('a fraction times a length stays a multiplier', () => {
		expect(keys(C.initialState(), `1 2 ft × 3 frac 4 =`).done).toEqual({ v: 108, d: 1 });
	});
});

describe('paste', () => {
	const p = (text: string, s = C.initialState()) => C.equals(C.paste(s, text, 16));
	it('reads values with units and marks', () => {
		expect(p(`8' 4 1/2"`).done).toEqual({ v: 100.5, d: 1 });
		expect(p('12 ft').done).toEqual({ v: 144, d: 1 });
		expect(p('10/2').done).toEqual({ v: 5, d: 0 });
	});
	it('leaves out what it does not know', () => {
		expect(p('45°').done).toEqual({ v: 45, d: 0 });
		expect(p('$1,234.50').done).toEqual({ v: 1234.5, d: 0 });
		expect(p('approx. 12.5 deg').done).toEqual({ v: 12.5, d: 0 });
	});
	it('reads formulas', () => {
		expect(p(`12' + 4' 6"`).done).toEqual({ v: 198, d: 1 });
		expect(p('12 ft x 10 ft').done).toEqual({ v: 17280, d: 2 });
		expect(p(`5'-6" - 2'`).done).toEqual({ v: 42, d: 1 });
		expect(p('(2 + 3) × 4').done).toEqual({ v: 20, d: 0 });
		expect(p('-3 + 10').done).toEqual({ v: 7, d: 0 });
		expect(p('10 / 4').done).toEqual({ v: 2.5, d: 0 });
	});
	it('a pasted fraction after a length is inches', () => {
		const s = C.op(C.paste(C.initialState(), `12'`, 16), '+', 16);
		expect(C.equals(C.paste(s, '3/4', 16)).done).toEqual({ v: 144.75, d: 1 });
		expect(C.equals(C.paste(s, '2 1/2', 16)).done).toEqual({ v: 146.5, d: 1 });
	});
});

describe('export report', async () => {
	const { projectCsv, takeoffLine, takeoffReport, quarters } = await import('$lib/export/report');
	const { WALL_DEFAULT, CONCRETE_DEFAULT, GROUT_DEFAULT } = await import('$lib/stores/app.svelte');
	const tk = (kind: 'framing' | 'grout' | 'concrete', data: unknown) => ({ id: 1, kind, name: 'T', data: structuredClone(data), updated: 0 });
	const project = { id: 1, name: 'Smith, "garage"', note: '', created: 0, updated: 0, takeoffs: [] };
	it('reads each kind', () => {
		expect(takeoffLine(tk('framing', WALL_DEFAULT), 16)).toBe('20 studs');
		expect(takeoffLine(tk('concrete', CONCRETE_DEFAULT), 16)).toBe('5¼ cu yd');
		expect(takeoffReport(tk('grout', GROUT_DEFAULT), 16).headline.unit).toBe('cu yd');
		expect(quarters(0.25)).toBe('¼');
	});
	it('quotes CSV cells', () => {
		const csv = projectCsv(project, [tk('concrete', CONCRETE_DEFAULT)], 16);
		expect(csv.startsWith('﻿Project,')).toBe(true);
		expect(csv).toContain('"Smith, ""garage"""');
	});
});

describe('picked values', () => {
	const tape = (q: { v: number; d: 0 | 1 | 2 | 3 }) => C.insert(C.initialState(), q, 16);
	it('go in as typed entries', () => {
		const s = tape({ v: 150.5, d: 1 });
		const last = s.tokens[s.tokens.length - 1];
		expect(last.kind).toBe('entry');
		expect(C.equals(s).done).toEqual({ v: 150.5, d: 1 });
	});
	it('take a unit like a typed number', () => {
		// 12 picked, then the feet key: 12'.
		const s = C.key(tape({ v: 12, d: 0 }), 'ft');
		expect(C.equals(s).done).toEqual({ v: 144, d: 1 });
	});
	it('pass their unit on after + (feet-inches: feet; a fraction: inches)', () => {
		let s = C.op(tape({ v: 150, d: 1 }), '+', 16);
		s = C.key(s, '2');
		expect(C.equals(s).done).toEqual({ v: 174, d: 1 });
		let t = C.op(tape({ v: 150, d: 1 }), '+', 16);
		for (const k of ['1', 'frac', '2'] as const) t = C.key(t, k);
		expect(C.equals(t).done).toEqual({ v: 150.5, d: 1 });
	});
	it('an answer passes its unit on too', () => {
		let s = C.equals(C.key(C.key(C.initialState(), '5'), 'ft'));
		s = C.key(C.op(s, '+', 16, 'ftin'), '3');
		expect(C.equals(s).done).toEqual({ v: 96, d: 1 });
	});
	it('keep values typing cannot give as fixed values', () => {
		const s = tape({ v: 10.123456, d: 1 });
		expect(s.tokens[s.tokens.length - 1].kind).toBe('value');
	});
});
