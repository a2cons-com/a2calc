<script lang="ts">
	// The editor every field opens: the full calculator (math, memory
	// letters, the tape, units) over the page. It opens on the field's
	// value as the answer, so a new number replaces it and an operator
	// works on it (+ 2′). The = key turns into Done once there is a value to
	// use: an answer, or a single number. Memory and the tape are the
	// calculator's own, shared with the calculator page.
	import { untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import * as C from '$lib/calc/calculator';
	import { formatFtIn, formatNumber, type Quantity } from '$lib/calc/units';
	import { editor, type EditRequest } from '$lib/stores/editor.svelte';
	import { calc, prefs } from '$lib/stores/app.svelte';
	import Calculator, { type Pick } from './Calculator.svelte';
	import Icon from './Icon.svelte';

	let req = $state<EditRequest | null>(null);
	let s = $state.raw<C.CalcState>(C.initialState());
	let seed = $state.raw<Quantity | null>(null);

	$effect(() => {
		const r = editor.req;
		if (!r) {
			req = null;
			return;
		}
		untrack(() => {
			req = r;
			seed = { v: r.value, d: r.kind === 'length' ? 1 : 0 };
			s = { ...C.initialState(), tape: calc.s.tape, vars: calc.s.vars, done: seed };
		});
	});

	// Answers and stored letters go back to the calculator's own memory.
	$effect(() => {
		const { tape, vars } = s;
		if (!req) return;
		untrack(() => {
			if (calc.s.tape !== tape || calc.s.vars !== vars) calc.s = { ...calc.s, tape, vars };
		});
	});

	const show = (v: number) => (req?.kind === 'length' ? formatFtIn(v, prefs.precision) : formatNumber(v, 4) + (req?.suffix ? ` ${req.suffix}` : ''));
	const close = () => (editor.req = null);

	/** The value to use in the field's terms, or an error to show. */
	function result(r: EditRequest, q: Quantity): number | string {
		let v = q.v;
		if (r.kind === 'length') {
			if (q.d === 0) v = q.v * (r.bare === 'ft' ? 12 : 1);
			else if (q.d !== 1) return q.d === 2 ? "That's an area, not a length" : "That's a volume, not a length";
		} else if (q.d !== 0) return 'Needs a plain number';
		if (r.integer) v = Math.round(v);
		if (!Number.isFinite(v)) return 'Not a number';
		if (r.min !== undefined && v < r.min) return `At least ${show(r.min)}`;
		if (r.max !== undefined && v > r.max) return `At most ${show(r.max)}`;
		return v;
	}

	function done() {
		if (!req) return;
		if (s.done === seed) return close();
		const finished = s.done ? s : C.equals(s);
		if (finished.error || !finished.done) {
			s = finished;
			return;
		}
		const v = result(req, finished.done);
		if (typeof v === 'string') {
			s = { ...finished, error: v };
			return;
		}
		s = finished;
		req.set(v);
		close();
	}

	const pick: Pick = $derived({
		hint: req ? (req.kind === 'length' ? `A plain number is ${req.bare === 'ft' ? 'feet' : 'inches'}` : req.integer ? 'A whole number' : 'A plain number') : '',
		seed,
		done,
		cancel: close
	});
</script>

{#if req}
	<div class="editor" role="dialog" aria-label={req.label} transition:fly={{ y: 500, duration: 220 }}>
		<Calculator bind:s {pick}>
			{#snippet lead()}
				<button class="close" onclick={close} aria-label="Cancel"><Icon name="close" /></button>
				<span class="label">{req?.label}</span>
			{/snippet}
		</Calculator>
	</div>
{/if}

<style>
	.editor {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: var(--bg);
		overflow: hidden;
	}
	.close {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: var(--text);
		margin-left: -6px;
	}
	.label {
		font-weight: 700;
		font-size: 1.15rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
