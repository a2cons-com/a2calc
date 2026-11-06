<script lang="ts">
	// One wall run in elevation: every member where it goes, the openings
	// behind them, and the run's length under it. Doors and windows can be
	// dragged along the wall (OpeningHandles).
	import { formatFtIn } from '$lib/calc/units';
	import type { Role, RunFraming } from '$lib/takeoff/framing';
	import { prefs } from '$lib/stores/app.svelte';
	import OpeningHandles from './OpeningHandles.svelte';

	let {
		rf,
		height,
		onmove,
		range
	}: {
		rf: RunFraming;
		height: number;
		/** A dragged opening's new left edge, inches from the run's start. */
		onmove?: (id: number, offset: number) => void;
		/** Where an opening's left edge may go: [min, max]. */
		range?: (id: number) => [number, number];
	} = $props();

	const FILL: Record<Role, string> = {
		stud: 'var(--wood)',
		corner: 'var(--wood)',
		king: 'var(--wood-king)',
		jack: 'var(--wood-king)',
		cripple: 'var(--wood)',
		header: 'var(--wood-header)',
		sill: 'var(--wood-header)',
		'top plate': 'var(--plate)',
		'bottom plate': 'var(--plate)'
	};
	const L = $derived(Math.max(rf.run.length, 12));
	const H = $derived(Math.max(height, 12));
	const s = $derived(Math.max(L, H));
	const pad = $derived(s * 0.03);
	const fs = $derived(Math.max(5, s * 0.038));
	const y = (yy: number, h: number) => H - yy - h;
	const members = $derived(rf.members.filter((m) => m.role !== 'header' || m.plies > 0));
	const bottom = (kind: string, sill: number) => (kind === 'door' ? 0 : sill);
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const handles = $derived(rf.placed.map((p) => ({ id: p.o.id, kind: p.o.kind, a: p.a, b: p.b, bottom: bottom(p.o.kind, p.o.sill), head: p.head })));
	/** Never smaller than 2 px per inch: long walls scroll sideways instead. */
	const minWidth = $derived(Math.round((L + pad * 2) * 2));
</script>

<div class="scroll">
<svg viewBox="{-pad} {-pad} {L + pad * 2} {H + pad * 2 + fs * 1.8}" style="min-width:{minWidth}px" role="img" aria-label="Wall framing elevation">
	{#each rf.placed as p (p.o.id)}
		{@const b = bottom(p.o.kind, p.o.sill)}
		<rect x={p.a} y={y(b, p.head - b)} width={p.b - p.a} height={p.head - b} fill="var(--opening)" stroke="var(--opening-edge)" stroke-width={s / 500} stroke-dasharray="{s / 120} {s / 160}" />
	{/each}
	{#each members as m, i (i)}
		<rect x={m.x} y={y(m.y, m.h)} width={m.w} height={m.h} fill={FILL[m.role]} stroke="var(--wood-edge)" stroke-width={s / 700} />
	{/each}
	<OpeningHandles {handles} floor={H} {fs} {s} {onmove} {range} />
	<line x1="0" x2={L} y1={H + pad} y2={H + pad} stroke="var(--faint)" stroke-width={s / 600} />
	<line x1="0" x2="0" y1={H + pad * 0.5} y2={H + pad * 1.5} stroke="var(--faint)" stroke-width={s / 600} />
	<line x1={L} x2={L} y1={H + pad * 0.5} y2={H + pad * 1.5} stroke="var(--faint)" stroke-width={s / 600} />
	<text x={L / 2} y={H + pad + fs * 1.3} text-anchor="middle" font-size={fs} class="dim">{ft(rf.run.length)}</text>
</svg>
</div>

<style>
	.scroll {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	svg {
		width: 100%;
		display: block;
		user-select: none;
		-webkit-user-select: none;
	}
	.dim {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
</style>
