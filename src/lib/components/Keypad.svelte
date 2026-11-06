<script lang="ts">
	// The keypad, in two layouts: the calculator (with operators) and the
	// value pad used by every input field (with Done). Big keys, few of
	// them; keys that make no sense right now are dimmed, not hidden, so
	// nothing moves under a thumb.
	import type { EntryKey } from '$lib/calc/entry';
	import type { Op } from '$lib/calc/expression';
	import { tap } from '$lib/native';
	import Icon from './Icon.svelte';

	type Fx = 'sq' | 'cube' | 'sqrt' | 'neg' | 'pi';

	let {
		mode = 'calc',
		can,
		allowLength = true,
		onkey,
		onback,
		onclear,
		onop,
		onequals,
		onunit,
		ondone,
		onfn,
		onquick,
		onparen,
		canParen = () => true,
		wide = false,
		unitEnabled = true
	}: {
		mode?: 'calc' | 'input';
		can: (k: EntryKey) => boolean;
		allowLength?: boolean;
		onkey: (k: EntryKey) => void;
		onback: () => void;
		onclear?: () => void;
		onop?: (o: Op) => void;
		onequals?: () => void;
		onunit?: () => void;
		ondone?: () => void;
		/** Landscape: the quick units and x² x³ √ as a column on the left. */
		onfn?: (f: Fx) => void;
		/** One-tap unit tags for the number just typed (5 then ft³). */
		onquick?: (u: 'sqft' | 'cuft' | 'cuyd') => void;
		onparen?: (p: '(' | ')') => void;
		canParen?: (p: '(' | ')') => boolean;
		wide?: boolean;
		unitEnabled?: boolean;
	} = $props();

	const k = (key: EntryKey) => () => {
		tap();
		onkey(key);
	};
	const enabled = (key: EntryKey) => can(key) && (allowLength || (key !== 'ft' && key !== 'in'));
</script>

{#snippet digit(d: EntryKey, cls = '')}
	<button class="key digit {cls}" disabled={!enabled(d)} onclick={k(d)}>{d === '.' ? '.' : d}</button>
{/snippet}
{#snippet unitKey(key: EntryKey, glyph: string, cap: string)}
	<button class="key unit" disabled={!enabled(key)} onclick={k(key)} aria-label={cap}>
		<span class="glyph">{glyph}</span><span class="cap">{cap}</span>
	</button>
{/snippet}
{#snippet opKey(o: Op)}
	<button
		class="key op"
		onclick={() => {
			tap();
			onop?.(o);
		}}>{o}</button
	>
{/snippet}

{#snippet quickKey(u: 'sqft' | 'cuft' | 'cuyd', label: string, aria: string)}
	<button class="key quick" aria-label={aria} disabled={!unitEnabled} onclick={() => { tap(); onquick?.(u); }}>{label}</button>
{/snippet}
{#snippet parens()}
	<div class="parens">
		<button class="key fn par" disabled={!canParen('(')} onclick={() => { tap(); onparen?.('('); }} aria-label="Open parenthesis">(</button>
		<button class="key fn par" disabled={!canParen(')')} onclick={() => { tap(); onparen?.(')'); }} aria-label="Close parenthesis">)</button>
	</div>
{/snippet}
{#snippet fnKey(f: Fx, label: string, aria: string)}
	<button class="key fx" aria-label={aria} onclick={() => { tap(); onfn?.(f); }}>{label}</button>
{/snippet}

{#if mode === 'calc' && wide}
	<div class="pad calc wide">
		{@render quickKey('sqft', 'ft²', 'Square feet')}
		<button class="key fn" onclick={() => { tap(true); onclear?.(); }}>AC</button>
		<button class="key fn" onclick={() => { tap(); onback(); }} aria-label="Backspace"><Icon name="backspace" size={24} /></button>
		{@render parens()}
		{@render opKey('÷')}

		{@render quickKey('cuft', 'ft³', 'Cubic feet')}
		{@render unitKey('ft', '′', 'feet')}
		{@render unitKey('in', '″', 'inch')}
		{@render unitKey('frac', '⁄', 'fraction')}
		{@render opKey('×')}

		{@render quickKey('cuyd', 'yd³', 'Cubic yards')}
		{@render digit('7')}{@render digit('8')}{@render digit('9')}{@render opKey('−')}
		{@render fnKey('sq', 'x²', 'Square')}
		{@render digit('4')}{@render digit('5')}{@render digit('6')}{@render opKey('+')}
		{@render fnKey('cube', 'x³', 'Cube')}
		{@render digit('1')}{@render digit('2')}{@render digit('3')}
		<button class="key eq" onclick={() => { tap(true); onequals?.(); }}>=</button>
		{@render fnKey('sqrt', '√', 'Square root')}
		{@render digit('0', 'wide-key')}{@render digit('.')}
	</div>
{:else if mode === 'calc'}
	<div class="pad calc">
		<div class="strip">
			{@render quickKey('sqft', 'ft²', 'Square feet')}
			{@render quickKey('cuft', 'ft³', 'Cubic feet')}
			{@render quickKey('cuyd', 'yd³', 'Cubic yards')}
			<button class="key quick unitmore" disabled={!unitEnabled} onclick={() => { tap(); onunit?.(); }}>Unit</button>
			<span class="gap"></span>
			{@render fnKey('sq', 'x²', 'Square')}
			{@render fnKey('cube', 'x³', 'Cube')}
			{@render fnKey('sqrt', '√', 'Square root')}
		</div>
		<button class="key fn" onclick={() => { tap(true); onclear?.(); }}>AC</button>
		<button class="key fn" onclick={() => { tap(); onback(); }} aria-label="Backspace"><Icon name="backspace" size={26} /></button>
		{@render parens()}
		{@render opKey('÷')}

		{@render unitKey('ft', '′', 'feet')}
		{@render unitKey('in', '″', 'inch')}
		{@render unitKey('frac', '⁄', 'fraction')}
		{@render opKey('×')}

		{@render digit('7')}{@render digit('8')}{@render digit('9')}{@render opKey('−')}
		{@render digit('4')}{@render digit('5')}{@render digit('6')}{@render opKey('+')}
		{@render digit('1')}{@render digit('2')}{@render digit('3')}
		<button class="key eq" onclick={() => { tap(true); onequals?.(); }}>=</button>
		{@render digit('0', 'wide-key')}{@render digit('.')}
	</div>
{:else}
	<div class="pad input">
		{@render digit('7')}{@render digit('8')}{@render digit('9')}{@render unitKey('ft', '′', 'feet')}
		{@render digit('4')}{@render digit('5')}{@render digit('6')}{@render unitKey('in', '″', 'inch')}
		{@render digit('1')}{@render digit('2')}{@render digit('3')}{@render unitKey('frac', '⁄', 'fraction')}
		{@render digit('.')}{@render digit('0')}
		<button class="key fn" onclick={() => { tap(); onback(); }} aria-label="Backspace"><Icon name="backspace" size={26} /></button>
		<button class="key eq small" onclick={() => { tap(true); ondone?.(); }}>Done</button>
	</div>
{/if}

<style>
	.pad {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		height: 100%;
	}
	.calc {
		grid-template-rows: 0.6fr 0.8fr 0.9fr repeat(4, 1fr);
	}
	/* Portrait: quick units and x² x³ √ as a slim strip over the keys. */
	.strip {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(4, 1fr) 2px repeat(3, 1fr);
		gap: 5px;
		min-height: 0;
	}
	.parens {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		min-height: 0;
	}
	.par {
		font-size: 1.6rem;
		font-weight: 500;
		font-family: var(--font-num);
	}
	.quick.unitmore {
		font-size: 0.9rem;
	}
	.quick {
		background: var(--key-unit);
		color: var(--primary-text);
		font-family: var(--font);
		font-size: 1.1rem;
		font-weight: 650;
	}
	.strip .key {
		border-radius: 14px;
		font-size: 1.15rem;
	}
	.input {
		grid-template-rows: repeat(4, minmax(40px, 1fr));
	}
	.key {
		border-radius: 18px;
		display: grid;
		place-items: center;
		font-family: var(--font-num);
		font-size: 1.75rem;
		font-weight: 500;
		box-shadow: var(--key-shadow);
		transition: transform 0.06s ease, filter 0.06s ease;
		min-height: 0;
	}
	.key:active:not(:disabled) {
		transform: scale(0.96);
		filter: brightness(0.93);
	}
	.key:disabled {
		opacity: 0.38;
	}
	.digit {
		background: var(--key-digit);
	}
	.wide-key,
	.span2 {
		grid-column: span 2;
	}
	.calc.wide {
		grid-template-columns: 0.85fr repeat(4, 1fr);
		grid-template-rows: repeat(6, 1fr);
		gap: 7px;
	}
	.calc.wide .strip {
		display: none;
	}
	.calc.wide .key {
		border-radius: 14px;
		font-size: 1.4rem;
	}
	.calc.wide .quick,
	.calc.wide .fx {
		font-size: 1.1rem;
	}
	.calc.wide .unit .glyph {
		font-size: 1.5rem;
	}
	.calc.wide .unit .cap {
		display: none;
	}
	.fx {
		background: var(--key-fn);
		color: var(--primary-text);
		font-size: 1.3rem;
		font-weight: 600;
	}

	.fn {
		background: var(--key-fn);
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--text);
	}
	.small {
		font-size: 1.05rem;
		font-family: var(--font);
		font-weight: 600;
	}
	.unit {
		background: var(--key-unit);
		color: var(--primary-text);
		display: flex;
		flex-direction: column;
		gap: 0;
		line-height: 1;
	}
	.unit .glyph {
		font-size: 1.9rem;
		font-weight: 600;
	}
	.unit .cap {
		font-family: var(--font);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.8;
		margin-top: 3px;
	}
	.op {
		background: var(--primary-soft);
		color: var(--primary-text);
		font-size: 2rem;
	}
	.eq {
		background: var(--primary);
		color: var(--primary-ink);
		font-size: 2.1rem;
	}
	.calc .eq {
		grid-row: span 2;
	}
	.eq.small {
		font-family: var(--font);
		font-size: 1.15rem;
		font-weight: 650;
	}
</style>
