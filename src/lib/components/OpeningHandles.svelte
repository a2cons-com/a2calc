<script lang="ts" module>
export interface Handle {
	id: number;
	kind: 'door' | 'window';
	a: number;
	b: number;
	bottom: number;
	head: number;
}

</script>

<script lang="ts">
	// Drag handles for the doors and windows in a wall elevation (studs or
	// block): a layer drawn inside the elevation's <svg>, in its wall-inch
	// coordinates with y = 0 at the floor flipped to `floor` (the svg's y of
	// the floor line). Openings move in 1″ steps within `range`; while one
	// moves, its distance from the wall's left end shows.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';

	let {
		handles,
		floor,
		fs,
		s,
		onmove,
		range
	}: {
		handles: Handle[];
		floor: number;
		/** Label size and drawing scale, in svg units. */
		fs: number;
		s: number;
		/** A dragged opening's new left edge, inches from the wall's start. */
		onmove?: (id: number, offset: number) => void;
		/** Where an opening's left edge may go: [min, max]. */
		range?: (id: number) => [number, number];
	} = $props();

	const y = (yy: number, h: number) => floor - yy - h;
	let layer: SVGGElement;
	let drag = $state<{ id: number; startX: number; startA: number; min: number; max: number } | null>(null);

	/** Pointer position in wall inches. */
	function wallX(e: PointerEvent): number {
		const svg = layer.ownerSVGElement;
		const m = svg?.getScreenCTM();
		if (!svg || !m) return 0;
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		return pt.matrixTransform(m.inverse()).x;
	}
	function down(e: PointerEvent, h: Handle) {
		if (!onmove) return;
		e.preventDefault();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		const [min, max] = range ? range(h.id) : [0, Infinity];
		drag = { id: h.id, startX: wallX(e), startA: h.a, min, max };
	}
	function move(e: PointerEvent) {
		if (!drag || !onmove) return;
		const a = Math.round(drag.startA + wallX(e) - drag.startX);
		onmove(drag.id, Math.max(drag.min, Math.min(drag.max, a)));
	}
	function up() {
		drag = null;
	}
	const dragged = $derived(drag ? handles.find((h) => h.id === drag!.id) : null);

	// A touch that starts on an opening is a drag, not a scroll: stop the
	// browser from taking it over (a scroll would cancel the pointer). Done
	// with a non-passive listener; CSS touch-action does not apply to SVG
	// groups. Touches elsewhere on the drawing still scroll.
	$effect(() => {
		if (!onmove || !layer) return;
		void handles.length;
		const stop = (e: Event) => e.preventDefault();
		const gs = [...layer.querySelectorAll<SVGGElement>('.handle')];
		for (const g of gs) g.addEventListener('touchstart', stop, { passive: false });
		return () => gs.forEach((g) => g.removeEventListener('touchstart', stop));
	});
</script>

<g bind:this={layer}>
	{#each handles as h (h.id)}
		<g
			class="handle"
			class:active={drag?.id === h.id}
			class:movable={!!onmove}
			onpointerdown={(e) => down(e, h)}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
			role="slider"
			aria-label="{h.kind === 'door' ? 'Door' : 'Window'} position"
			aria-valuenow={Math.round(h.a)}
			tabindex="-1"
		>
			<rect x={h.a} y={y(h.bottom, h.head - h.bottom)} width={h.b - h.a} height={h.head - h.bottom} fill="transparent" stroke={drag?.id === h.id ? 'var(--primary)' : 'none'} stroke-width={s / 250} />
			<text x={(h.a + h.b) / 2} y={y(h.bottom, 0) - (h.head - h.bottom) / 2} text-anchor="middle" dominant-baseline="middle" font-size={fs * 0.9} class="op">
				{onmove ? '⇆ ' : ''}{h.kind === 'door' ? 'Door' : 'Window'}
			</text>
		</g>
	{/each}
	{#if dragged}
		{@const yy = y(dragged.bottom, 0) - (dragged.head - dragged.bottom) - fs * 0.6}
		<line x1="0" x2={dragged.a} y1={yy} y2={yy} stroke="var(--primary)" stroke-width={s / 400} />
		<text x={dragged.a / 2} y={yy - fs * 0.35} text-anchor="middle" font-size={fs} class="live">{formatFtIn(dragged.a, prefs.precision)}</text>
	{/if}
</g>

<style>
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
