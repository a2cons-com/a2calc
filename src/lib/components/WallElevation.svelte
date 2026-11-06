<script lang="ts">
	// One wall run in elevation: every member where it goes, the openings
	// behind them, and the run's length under it.
	import { formatFtIn } from '$lib/calc/units';
	import type { Role, RunFraming } from '$lib/takeoff/framing';
	import { prefs } from '$lib/stores/app.svelte';

	let { rf, height }: { rf: RunFraming; height: number } = $props();

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
</script>

<svg viewBox="{-pad} {-pad} {L + pad * 2} {H + pad * 2 + fs * 1.8}" role="img" aria-label="Wall framing elevation">
	{#each rf.placed as p (p.o.id)}
		<rect x={p.a} y={y(p.o.kind === 'door' ? 0 : p.o.sill, p.head - (p.o.kind === 'door' ? 0 : p.o.sill))} width={p.b - p.a} height={p.head - (p.o.kind === 'door' ? 0 : p.o.sill)} fill="var(--opening)" stroke="var(--opening-edge)" stroke-width={s / 500} stroke-dasharray="{s / 120} {s / 160}" />
		<text x={(p.a + p.b) / 2} y={y(p.o.kind === 'door' ? 0 : p.o.sill, 0) - (p.head - (p.o.kind === 'door' ? 0 : p.o.sill)) / 2} text-anchor="middle" dominant-baseline="middle" font-size={fs * 0.9} class="op">
			{p.o.kind === 'door' ? 'Door' : 'Window'}
		</text>
	{/each}
	{#each members as m, i (i)}
		<rect x={m.x} y={y(m.y, m.h)} width={m.w} height={m.h} fill={FILL[m.role]} stroke="var(--wood-edge)" stroke-width={s / 700} />
	{/each}
	<line x1="0" x2={L} y1={H + pad} y2={H + pad} stroke="var(--faint)" stroke-width={s / 600} />
	<line x1="0" x2="0" y1={H + pad * 0.5} y2={H + pad * 1.5} stroke="var(--faint)" stroke-width={s / 600} />
	<line x1={L} x2={L} y1={H + pad * 0.5} y2={H + pad * 1.5} stroke="var(--faint)" stroke-width={s / 600} />
	<text x={L / 2} y={H + pad + fs * 1.3} text-anchor="middle" font-size={fs} class="dim">{formatFtIn(rf.run.length, prefs.precision)}</text>
</svg>

<style>
	svg {
		width: 100%;
		max-height: 240px;
		display: block;
	}
	.dim {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
	.op {
		font-family: var(--font);
		font-weight: 600;
		fill: var(--opening-edge);
	}
</style>
