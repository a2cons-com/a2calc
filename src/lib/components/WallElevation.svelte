<script lang="ts">
	// One wall run in elevation: every member where it goes, the openings
	// behind them, and the run's length under it. Doors and windows can be
	// dragged along the wall (1″ steps, kept a foot from each other and 6″
	// from the ends); while one moves, its distance from the left end shows.
	import { formatFtIn } from '$lib/calc/units';
	import type { Role, RunFraming } from '$lib/takeoff/framing';
	import { prefs } from '$lib/stores/app.svelte';

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

	let svg: SVGSVGElement;
	let drag = $state<{ id: number; startX: number; startA: number; min: number; max: number } | null>(null);

	/** Pointer position in wall inches. */
	function wallX(e: PointerEvent): number {
		const m = svg.getScreenCTM();
		if (!m) return 0;
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		return pt.matrixTransform(m.inverse()).x;
	}

	function down(e: PointerEvent, id: number, a: number) {
		if (!onmove) return;
		e.preventDefault();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		const [min, max] = range ? range(id) : [0, L];
		drag = { id, startX: wallX(e), startA: a, min, max };
	}
	function move(e: PointerEvent) {
		if (!drag || !onmove) return;
		const a = Math.round(drag.startA + wallX(e) - drag.startX);
		onmove(drag.id, Math.max(drag.min, Math.min(drag.max, a)));
	}
	function up() {
		drag = null;
	}
	const dragged = $derived(drag ? rf.placed.find((p) => p.o.id === drag!.id) : null);

	// A touch that starts on an opening is a drag, not a scroll: stop the
	// browser from taking it over (a scroll would cancel the pointer). Done
	// with a non-passive listener; CSS touch-action does not apply to SVG
	// groups. Touches elsewhere on the drawing still scroll.
	$effect(() => {
		if (!onmove || !svg) return;
		void rf.placed.length;
		const stop = (e: Event) => e.preventDefault();
		const handles = [...svg.querySelectorAll<SVGGElement>('.handle')];
		for (const h of handles) h.addEventListener('touchstart', stop, { passive: false });
		return () => handles.forEach((h) => h.removeEventListener('touchstart', stop));
	});
	/** Never smaller than 2 px per inch: long walls scroll sideways instead. */
	const minWidth = $derived(Math.round((L + pad * 2) * 2));
</script>

<div class="scroll">
<svg bind:this={svg} viewBox="{-pad} {-pad} {L + pad * 2} {H + pad * 2 + fs * 1.8}" style="min-width:{minWidth}px" role="img" aria-label="Wall framing elevation">
	{#each rf.placed as p (p.o.id)}
		{@const b = bottom(p.o.kind, p.o.sill)}
		<rect x={p.a} y={y(b, p.head - b)} width={p.b - p.a} height={p.head - b} fill="var(--opening)" stroke="var(--opening-edge)" stroke-width={s / 500} stroke-dasharray="{s / 120} {s / 160}" />
	{/each}
	{#each members as m, i (i)}
		<rect x={m.x} y={y(m.y, m.h)} width={m.w} height={m.h} fill={FILL[m.role]} stroke="var(--wood-edge)" stroke-width={s / 700} />
	{/each}
	<!-- Drag handles: on top of the framing, one per opening -->
	{#each rf.placed as p (p.o.id)}
		{@const b = bottom(p.o.kind, p.o.sill)}
		<g
			class="handle"
			class:active={drag?.id === p.o.id}
			class:movable={!!onmove}
			onpointerdown={(e) => down(e, p.o.id, p.a)}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
			role="slider"
			aria-label="{p.o.kind === 'door' ? 'Door' : 'Window'} position"
			aria-valuenow={Math.round(p.a)}
			tabindex="-1"
		>
			<rect x={p.a} y={y(b, p.head - b)} width={p.b - p.a} height={p.head - b} fill="transparent" stroke={drag?.id === p.o.id ? 'var(--primary)' : 'none'} stroke-width={s / 250} />
			<text x={(p.a + p.b) / 2} y={y(b, 0) - (p.head - b) / 2} text-anchor="middle" dominant-baseline="middle" font-size={fs * 0.9} class="op">
				{onmove ? '⇆ ' : ''}{p.o.kind === 'door' ? 'Door' : 'Window'}
			</text>
		</g>
	{/each}
	{#if dragged}
		<!-- distance from the wall's left end while moving -->
		{@const yy = y(bottom(dragged.o.kind, dragged.o.sill), 0) - (dragged.head - bottom(dragged.o.kind, dragged.o.sill)) - fs * 0.6}
		<line x1="0" x2={dragged.a} y1={yy} y2={yy} stroke="var(--primary)" stroke-width={s / 400} />
		<text x={dragged.a / 2} y={yy - fs * 0.35} text-anchor="middle" font-size={fs} class="live">{ft(dragged.a)}</text>
	{/if}
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
	.op {
		font-family: var(--font);
		font-weight: 700;
		fill: var(--opening-edge);
		pointer-events: none;
	}
	.handle.movable {
		cursor: grab;
	}
	.handle.active {
		cursor: grabbing;
	}
	.handle.active .op {
		fill: var(--primary-text);
	}
	.live {
		font-family: var(--font-num);
		font-weight: 700;
		fill: var(--primary-text);
	}
</style>
