<script lang="ts">
	// One concrete piece from above, to scale, dimensioned on two sides;
	// its height or thickness (which a plan can't show) written inside.
	import { formatFtIn } from '$lib/calc/units';
	import type { Piece } from '$lib/takeoff/concrete';
	import { prefs } from '$lib/stores/app.svelte';

	let { piece }: { piece: Piece } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const pos = (v: number) => Math.max(0, v || 0);

	/** Plan size (x across the screen, y down) and the third dimension. */
	const d = $derived.by(() => {
		const p = piece;
		switch (p.kind) {
			case 'wall':
				return { x: pos(p.a), y: pos(p.c), up: `${ft(pos(p.b))} high`, round: false };
			case 'column':
				return { x: pos(p.a), y: pos(p.b), up: `${ft(pos(p.c))} high`, round: false };
			case 'round':
				return { x: pos(p.a), y: pos(p.a), up: `${ft(pos(p.b))} high`, round: true };
			case 'slab':
				return { x: pos(p.a), y: pos(p.b), up: `${ft(pos(p.c))} thick`, round: false };
			default:
				return { x: pos(p.a), y: pos(p.b), up: `${ft(pos(p.c))} deep`, round: false };
		}
	});
	const big = $derived(Math.max(d.x, d.y, 1));
	// A very thin side is drawn at 3% so it still shows.
	const w = $derived(Math.max(d.x, big * 0.03));
	const h = $derived(Math.max(d.y, big * 0.03));
	const fs = $derived(big * 0.06);
	const off = $derived(fs * 1.6);
	const m = $derived(off + fs * 1.6);
	const sw = $derived(big / 350);
	/** The label inside, or beside a shape too thin to hold it. */
	const inside = $derived(h > fs * 2.2 && w > fs * 6);
</script>

{#snippet tick(x: number, y: number)}
	<line x1={x - fs * 0.3} y1={y + fs * 0.3} x2={x + fs * 0.3} y2={y - fs * 0.3} class="dl" stroke-width={sw * 2} />
{/snippet}

<svg viewBox="{-m} {-m} {w + 2 * m} {h + 2 * m + (inside ? 0 : fs * 2)}" role="img" aria-label="Plan of the piece">
	{#if d.round}
		<circle cx={w / 2} cy={h / 2} r={w / 2} class="body" stroke-width={sw} />
	{:else}
		<rect width={w} height={h} class="body" stroke-width={sw} />
	{/if}
	<!-- across the top -->
	<line x1="0" x2={w} y1={-off} y2={-off} class="dl" stroke-width={sw} />
	<line x1="0" x2="0" y1={-fs * 0.4} y2={-off - fs * 0.4} class="ext" stroke-width={sw} />
	<line x1={w} x2={w} y1={-fs * 0.4} y2={-off - fs * 0.4} class="ext" stroke-width={sw} />
	{@render tick(0, -off)}{@render tick(w, -off)}
	<text x={w / 2} y={-off - fs * 0.5} font-size={fs} class="dt" text-anchor="middle">{d.round ? `⌀ ${ft(d.x)}` : ft(d.x)}</text>
	{#if !d.round}
		<!-- down the right side -->
		<line x1={w + off} x2={w + off} y1="0" y2={h} class="dl" stroke-width={sw} />
		<line x1={w + fs * 0.4} x2={w + off + fs * 0.4} y1="0" y2="0" class="ext" stroke-width={sw} />
		<line x1={w + fs * 0.4} x2={w + off + fs * 0.4} y1={h} y2={h} class="ext" stroke-width={sw} />
		{@render tick(w + off, 0)}{@render tick(w + off, h)}
		<text x={w + off + fs * 0.5} y={h / 2} font-size={fs} class="dt" text-anchor="middle" transform="rotate(90 {w + off + fs * 0.5} {h / 2})">{ft(d.y)}</text>
	{/if}
	<text x={w / 2} y={inside ? h / 2 : h + fs * 1.6} font-size={fs * 0.9} class="up" text-anchor="middle" dominant-baseline="middle">
		{d.up}{piece.count > 1 ? ` · ×${piece.count}` : ''}
	</text>
</svg>

<style>
	svg {
		width: 100%;
		max-height: 260px;
		display: block;
	}
	.body {
		fill: var(--concrete-top);
		stroke: var(--concrete-side);
	}
	.dl {
		stroke: var(--primary-text);
	}
	.ext {
		stroke: var(--border);
	}
	.dt {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--primary-text);
	}
	.up {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
</style>
