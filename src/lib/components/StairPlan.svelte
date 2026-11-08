<script lang="ts">
	// The stair from above: treads and landings, the floor opening
	// (dashed), an UP arrow; the run and the width dimensioned.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import type { StairInput, StairResult } from '$lib/takeoff/stairs';

	let { input, r }: { input: StairInput; r: StairResult } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const W = $derived(Math.max(12, input.width));
	const big = $derived(Math.max(r.run, W, 1));
	const fs = $derived(Math.max(4, big * 0.045));
	const sw = $derived(big / 400);
	const off = $derived(fs * 1.7);
	const mid = $derived(W / 2);
</script>

{#snippet tick(x: number, y: number)}
	<line x1={x - fs * 0.3} y1={y + fs * 0.3} x2={x + fs * 0.3} y2={y - fs * 0.3} class="dl" stroke-width={sw * 2} />
{/snippet}

<svg viewBox="{-off * 1.6} {-off * 1.8} {r.run + 36 + off * 3} {W + off * 3.4}" role="img" aria-label="Stair plan">
	{#each r.steps as s, i (i)}
		{#if s.kind === 'tread'}
			<rect x={s.x0} y="0" width={s.x1 - s.x0} height={W} class="tread" stroke-width={sw} />
		{:else if s.kind === 'landing'}
			<rect x={s.x0} y="0" width={s.x1 - s.x0} height={W} class="landing" stroke-width={sw} />
			<text x={(s.x0 + s.x1) / 2} y={mid + fs * 0.35} font-size={fs * 0.8} class="lbl" text-anchor="middle">LANDING</text>
		{:else}
			<rect x={s.x0} y="0" width="36" height={W} class="floor" stroke-width={sw} />
		{/if}
	{/each}
	{#if r.opening > 0}
		<rect x={r.openingAt} y={-fs * 0.4} width={r.opening} height={W + fs * 0.8} class="open" stroke-width={sw * 1.4} stroke-dasharray="{fs * 0.6} {fs * 0.4}" fill="none" />
	{/if}
	<!-- UP arrow along the first flight -->
	{#if r.flights[0]}
		{@const a = Math.max(r.flights[0].x0 + 4, 4)}
		{@const b = Math.max(a + 10, r.flights[0].x1 - 6)}
		<line x1={a} x2={b} y1={mid} y2={mid} class="arrow" stroke-width={sw * 2} />
		<polyline points="{b - fs * 0.7},{mid - fs * 0.5} {b},{mid} {b - fs * 0.7},{mid + fs * 0.5}" class="arrow" stroke-width={sw * 2} fill="none" />
		<text x={a} y={mid - fs * 0.5} font-size={fs * 0.85} class="lbl">UP</text>
	{/if}
	<!-- run along the top, width down the left -->
	<line x1="0" x2={r.run} y1={-off} y2={-off} class="dl" stroke-width={sw} />
	{@render tick(0, -off)}{@render tick(r.run, -off)}
	<text x={r.run / 2} y={-off - fs * 0.45} font-size={fs} class="dt" text-anchor="middle">{ft(r.run)}</text>
	<line x1={-off} x2={-off} y1="0" y2={W} class="dl" stroke-width={sw} />
	{@render tick(-off, 0)}{@render tick(-off, W)}
	<text x={-off - fs * 0.5} y={mid} font-size={fs} class="dt" text-anchor="middle" transform="rotate(-90 {-off - fs * 0.5} {mid})">{ft(W)}</text>
	{#if r.opening > 0}
		<text x={r.openingAt + r.opening / 2} y={W + fs * 1.6} font-size={fs * 0.8} class="ot" text-anchor="middle">Opening {ft(r.opening)}</text>
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: 260px;
	}
	.tread {
		fill: var(--wood);
		stroke: var(--wood-edge);
	}
	.landing {
		fill: var(--wood-king);
		stroke: var(--wood-edge);
	}
	.floor {
		fill: var(--concrete-top);
		stroke: var(--concrete-side);
	}
	.open {
		stroke: var(--warn-text);
	}
	.ot {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--warn-text);
	}
	.arrow {
		stroke: var(--text);
	}
	.lbl {
		font-family: var(--font-num);
		font-weight: 700;
		fill: var(--text);
	}
	.dl {
		stroke: var(--primary-text);
	}
	.dt {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--primary-text);
	}
</style>
