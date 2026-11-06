<script lang="ts">
	import { canPress, emptyEntry, entryValue, formatEntry, press, backspace, type Entry, type EntryKey } from '$lib/calc/entry';
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { editor } from '$lib/stores/editor.svelte';
	import { prefs } from '$lib/stores/app.svelte';
	import Keypad from './Keypad.svelte';
	import Sheet from './Sheet.svelte';

	let entry = $state<Entry>(emptyEntry());
	let open = $state(false);
	const req = $derived(editor.req);

	$effect(() => {
		if (editor.req) {
			entry = emptyEntry();
			open = true;
		}
	});
	$effect(() => {
		if (!open && editor.req) editor.req = null;
	});

	const show = (v: number) => (req?.kind === 'length' ? formatFtIn(v, prefs.precision) : formatNumber(v, 4) + (req?.suffix ? ` ${req.suffix}` : ''));

	/** The typed value in the field's terms, or null when nothing / invalid. */
	const typed = $derived.by(() => {
		if (!req) return null;
		const q = entryValue(entry);
		if (!q) return null;
		let v = q.v;
		if (req.kind === 'length' && q.d === 0) v = q.v * (req.bare === 'ft' ? 12 : 1);
		if (req.integer) v = Math.round(v);
		return v;
	});
	const problem = $derived.by(() => {
		if (!req || typed === null) return null;
		if (req.min !== undefined && typed < req.min) return `At least ${show(req.min)}`;
		if (req.max !== undefined && typed > req.max) return `At most ${show(req.max)}`;
		return null;
	});

	function done() {
		if (req && typed !== null && !problem) req.set(typed);
		open = false;
	}
	const can = (k: EntryKey) => canPress(entry, k) && !(req?.integer && (k === '.' || k === 'frac'));
</script>

<Sheet bind:open title={req?.label ?? ''}>
	{#if req}
		<div class="readout">
			<div class="now num" class:typing={entry.raw !== ''}>
				{#if entry.raw !== ''}
					{formatEntry(entry)}{#if req.kind === 'length' && !/['"]/.test(entry.raw)}<span class="bare">&nbsp;{req.bare === 'ft' ? 'ft' : 'in'}</span>{/if}
				{:else}
					{show(req.value)}
				{/if}
			</div>
			<div class="hint">
				{#if problem}
					<span class="bad">{problem}</span>
				{:else if entry.raw !== '' && typed !== null && req.kind === 'length'}
					= {show(typed)}
				{:else if req.kind === 'length'}
					Type a new value · a plain number is {req.bare === 'ft' ? 'feet' : 'inches'}
				{:else}
					Type a new value
				{/if}
			</div>
		</div>
		<div class="pad">
			<Keypad mode="input" {can} allowLength={req.kind === 'length'} onkey={(k) => (entry = press(entry, k))} onback={() => (entry = backspace(entry))} ondone={done} />
		</div>
	{/if}
</Sheet>

<style>
	.readout {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 14px 16px;
		text-align: right;
		margin-bottom: 12px;
	}
	.now {
		font-size: 2.2rem;
		font-weight: 600;
		color: var(--faint);
		min-height: 2.6rem;
		white-space: nowrap;
		overflow-x: auto;
	}
	.now.typing {
		color: var(--text);
	}
	.bare {
		font-size: 1.1rem;
		color: var(--muted);
	}
	.hint {
		font-size: 0.85rem;
		color: var(--muted);
		min-height: 1.2em;
		margin-top: 2px;
	}
	.bad {
		color: var(--danger);
	}
	.pad {
		height: min(340px, 46dvh);
	}
</style>
