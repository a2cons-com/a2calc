// Physical keyboard (Mac, iPad with keyboard, the web). Maps a key to a
// calculator action. "/" is smart: inside a number it starts a fraction
// (5'3/8, 3/4), otherwise it divides; the two give the same value wherever
// both would apply, so the shortcut can't change an answer.

import type { EntryKey } from './calc/entry';
import type { Op } from './calc/expression';

export type KeyAction =
	| { kind: 'entry'; key: EntryKey }
	| { kind: 'slash' }
	| { kind: 'op'; op: Op }
	| { kind: 'paren'; p: '(' | ')' }
	| { kind: 'equals' }
	| { kind: 'back' }
	| { kind: 'clear' }
	| { kind: 'copy' }
	| { kind: 'paste' }
	| { kind: 'var'; name: string };

export function keyAction(e: KeyboardEvent): KeyAction | null {
	const mod = e.metaKey || e.ctrlKey;
	if (mod) {
		if (e.key === 'c' || e.key === 'C') return { kind: 'copy' };
		if (e.key === 'v' || e.key === 'V') return { kind: 'paste' };
		return null;
	}
	if (e.altKey) return null;
	const k = e.key;
	if (/^[0-9]$/.test(k)) return { kind: 'entry', key: k as EntryKey };
	switch (k) {
		case '.':
		case ',':
			return { kind: 'entry', key: '.' };
		case "'":
		case '′':
		case '’':
			return { kind: 'entry', key: 'ft' };
		case '"':
		case '″':
		case '”':
			return { kind: 'entry', key: 'in' };
		case '/':
			return { kind: 'slash' };
		case '÷':
		case ':':
			return { kind: 'op', op: '÷' };
		case '*':
		case 'x':
		case 'X':
		case '×':
			return { kind: 'op', op: '×' };
		case '+':
			return { kind: 'op', op: '+' };
		case '-':
		case '−':
			return { kind: 'op', op: '−' };
		case '(':
		case ')':
			return { kind: 'paren', p: k };
		case 'Enter':
		case '=':
			return { kind: 'equals' };
		case 'Backspace':
			return { kind: 'back' };
		case 'Escape':
		case 'Clear':
		case 'Delete':
			return { kind: 'clear' };
	}
	if (/^[a-fA-F]$/.test(k)) return { kind: 'var', name: k.toUpperCase() };
	return null;
}
