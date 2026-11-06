<script lang="ts">
	// A labelled value that opens the value editor when tapped.
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { edit, type EditRequest } from '$lib/stores/editor.svelte';
	import { prefs } from '$lib/stores/app.svelte';

	let {
		label,
		value = $bindable(),
		kind = 'length',
		bare = 'in',
		suffix = '',
		min,
		max,
		integer = false,
		note = '',
		onchange
	}: {
		label: string;
		value: number;
		kind?: 'length' | 'number';
		bare?: 'ft' | 'in';
		suffix?: string;
		min?: number;
		max?: number;
		integer?: boolean;
		note?: string;
		/** For a value that isn't bound (a computed default, like centered). */
		onchange?: (v: number) => void;
	} = $props();

	const text = $derived(kind === 'length' ? formatFtIn(value, prefs.precision) : formatNumber(value, 3));

	function open() {
		const req: EditRequest = { label, kind, value, bare, min, max, integer, suffix, set: (v) => {
			value = v;
			onchange?.(v);
		} };
		edit(req);
	}
</script>

<button class="field" onclick={open}>
	<span class="label">{label}{#if note}<small>{note}</small>{/if}</span>
	<span class="value num">{text}{#if suffix}<span class="suffix">{suffix}</span>{/if}</span>
</button>

<style>
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 13px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-align: left;
		min-height: 52px;
	}
	.field:active {
		background: var(--surface-2);
	}
	.label {
		color: var(--muted);
		font-size: 0.95rem;
		display: flex;
		flex-direction: column;
	}
	.label small {
		font-size: 0.75rem;
		color: var(--faint);
	}
	.value {
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
	}
	.suffix {
		font-size: 0.85rem;
		color: var(--muted);
		margin-left: 4px;
		font-weight: 500;
	}
</style>
