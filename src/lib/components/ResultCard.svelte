<script lang="ts">
	// The answer of a takeoff: one big figure and the lines it is made of.
	import type { Snippet } from 'svelte';
	let { label, value, unit = '', children }: { label: string; value: string; unit?: string; children?: Snippet } = $props();
</script>

<div class="result">
	<div class="top">
		<span class="label">{label}</span>
		<span class="value num">{value}<span class="unit">{unit}</span></span>
	</div>
	{#if children}<div class="lines">{@render children()}</div>{/if}
</div>

<style>
	.result {
		background: var(--primary);
		color: var(--primary-ink);
		border-radius: var(--radius);
		padding: 16px 18px;
	}
	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.label {
		font-weight: 600;
		opacity: 0.9;
	}
	.value {
		font-size: 2.3rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.unit {
		font-size: 1.1rem;
		font-weight: 600;
		margin-left: 6px;
		opacity: 0.9;
	}
	.lines {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid rgba(255, 255, 255, 0.22);
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 12px;
		font-size: 0.92rem;
	}
	.lines :global(span:nth-child(odd)) {
		opacity: 0.85;
	}
	.lines :global(span:nth-child(even)) {
		text-align: right;
		font-family: var(--font-num);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
</style>
