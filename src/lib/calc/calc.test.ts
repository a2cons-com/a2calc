import { describe, expect, it } from 'vitest';
import { canPress, emptyEntry, entryValue, formatEntry, parseText, press, backspace, type Entry, type EntryKey } from './entry';
import { evaluate, CalcError } from './expression';
import { formatAs, formatFtIn, fromUnit, toUnit, splitFtIn } from './units';
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
		expect(formatEntry(type(`5'3"1/2`))).toBe('5′ 3 1⁄2″');
		expect(formatEntry(type("5'3"))).toBe('5′ 3');
		expect(formatEntry(type(`5'3"1/`))).toBe('5′ 3 1⁄″');
		expect(formatEntry(type('3/4'))).toBe('3⁄4');
	});
	it('refuses keys that make no sense', () => {
		expect(canPress(emptyEntry(), 'ft')).toBe(false);
		expect(canPress(type("5'"), 'ft')).toBe(false);
		expect(canPress(type('3/'), 'in')).toBe(false);
		expect(canPress(type('3/4'), 'in')).toBe(true);
		expect(canPress(type('3/4'), 'frac')).toBe(false);
		expect(canPress(type('3.5'), 'frac')).toBe(false);
		expect(canPress(type(`3"`), '.')).toBe(false);
		expect(canPress(type(`3/4"`), '5')).toBe(false);
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
		expect(formatFtIn(63.5, 16)).toBe('5′ 3 1⁄2″');
		expect(formatFtIn(60, 16)).toBe('5′');
		expect(formatFtIn(0.75, 16)).toBe('3⁄4″');
		expect(formatFtIn(0, 16)).toBe('0″');
		expect(formatFtIn(63.5, 16, true)).toBe('63 1⁄2″');
		expect(formatFtIn(-14.25, 16)).toBe('−1′ 2 1⁄4″');
		// 1/3" at 1/16 rounds to 5/16; 11.99" rounds up to a whole foot
		expect(formatFtIn(1 / 3, 16)).toBe('5⁄16″');
		expect(splitFtIn(1 / 3, 16).rounded).toBe(true);
		expect(formatFtIn(11.99, 16)).toBe('1′');
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
		expect(formatAs(s.done!, 'ftin', 16).text).toBe('8′ 2 1⁄4″');
		expect(s.tape[0].expr).toBe('5′ 3 1⁄2″ + 2′ 10 3⁄4″');
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
		s = keys(C.initialState(), `5'+3=`);
		expect(s.error).toMatch(/plain number/);
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
