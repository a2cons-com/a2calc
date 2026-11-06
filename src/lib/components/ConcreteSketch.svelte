<script lang="ts">
	// An isometric sketch of one concrete piece with its dimensions. Thin
	// sides are drawn thicker than true so a 4" slab still reads as a slab.
	import { formatFtIn } from '$lib/calc/units';
	import type { Piece } from '$lib/takeoff/concrete';
	import { prefs } from '$lib/stores/app.svelte';

	let { piece }: { piece: Piece } = $props();

	const C30 = Math.cos(Math.PI / 6);
	const S30 = 0.5;
	const iso = (x: number, y: number, z: number): [number, number] => [(x - y) * C30, (x + y) * S30 - z];
	const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
	const fmt = (v: number) => formatFtIn(v, prefs.precision);

	/** True dims (x along, y across, z up) and the labels on each. */
	const dims = $derived.by(() => {
		const p = piece;
		switch (p.kind) {
			case 'slab':
			case 'footing':
			case 'beam':
				return { x: p.a, y: p.b, z: p.c, lx: fmt(p.a), ly: fmt(p.b), lz: fmt(p.c) };
			case 'wall':
				return { x: p.a, y: p.c, z: p.b, lx: fmt(p.a), ly: fmt(p.c), lz: fmt(p.b) };
			case 'column':
				return { x: p.a, y: p.b, z: p.c, lx: fmt(p.a), ly: fmt(p.b), lz: fmt(p.c) };
			case 'round':
				return { x: p.a, y: p.a, z: p.b, lx: `⌀ ${fmt(p.a)}`, ly: '', lz: fmt(p.b) };
		}
	});

	/** Drawn dims: each at least 12% of the largest. */
	const box = $derived.by(() => {
		const m = Math.max(dims.x, dims.y, dims.z, 1);
		const f = (v: number) => Math.max(v / m, 0.12) * 100;
		return { x: f(dims.x), y: f(dims.y), z: f(dims.z) };
	});

	const geo = $derived.by(() => {
		const { x, y, z } = box;
		const top = [iso(0, 0, z), iso(x, 0, z), iso(x, y, z), iso(0, y, z)];
		const right = [iso(x, 0, 0), iso(x, y, 0), iso(x, y, z), iso(x, 0, z)];
		const left = [iso(0, y, 0), iso(x, y, 0), iso(x, y, z), iso(0, y, z)];
		const all = [...top, ...right, ...left];
		const xs = all.map((p) => p[0]);
		const ys = all.map((p) => p[1]);
		const pad = 34;
		return {
			top, right, left,
			vb: `${Math.min(...xs) - pad} ${Math.min(...ys) - pad / 2} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 1.4}`,
			// label anchors: along x (front-left edge), along y (front-right edge), up z (front corner)
			lx: iso(x / 2, y, 0),
			ly: iso(x, y / 2, 0),
			lz: iso(x, y, z / 2)
		};
	});

	const cyl = $derived.by(() => {
		const r = box.x / 2;
		const h = box.z;
		return { r, h, rx: r * 1.15, ry: r * 0.55 };
	});
</script>

<svg class="sketch" viewBox={piece.kind === 'round' ? `${-cyl.rx - 40} ${-cyl.h - cyl.ry - 14} ${cyl.rx * 2 + 80} ${cyl.h + cyl.ry * 2 + 40}` : geo.vb} role="img" aria-label="Sketch of the piece">
	{#if piece.kind === 'round'}
		<path d="M{-cyl.rx},{-cyl.h} L{-cyl.rx},0 A{cyl.rx},{cyl.ry} 0 0 0 {cyl.rx},0 L{cyl.rx},{-cyl.h} Z" fill="var(--concrete-side)" stroke="var(--cmu-edge)" stroke-width="0.8" />
		<ellipse cx="0" cy={-cyl.h} rx={cyl.rx} ry={cyl.ry} fill="var(--concrete-top)" stroke="var(--cmu-edge)" stroke-width="0.8" />
		<text x="0" y={-cyl.h + 4} class="lbl" text-anchor="middle">{dims.lx}</text>
		<text x={cyl.rx + 6} y={-cyl.h / 2} class="lbl">{dims.lz}</text>
	{:else}
		<polygon points={pts(geo.left)} fill="var(--concrete)" stroke="var(--cmu-edge)" stroke-width="0.8" />
		<polygon points={pts(geo.right)} fill="var(--concrete-side)" stroke="var(--cmu-edge)" stroke-width="0.8" />
		<polygon points={pts(geo.top)} fill="var(--concrete-top)" stroke="var(--cmu-edge)" stroke-width="0.8" />
		<text x={geo.lx[0] - 6} y={geo.lx[1] + 14} class="lbl" text-anchor="end">{dims.lx}</text>
		<text x={geo.ly[0] + 6} y={geo.ly[1] + 14} class="lbl">{dims.ly}</text>
		<text x={geo.lz[0] + 6} y={geo.lz[1] + 4} class="lbl">{dims.lz}</text>
	{/if}
</svg>

<style>
	.sketch {
		width: 100%;
		height: 180px;
		display: block;
	}
	.lbl {
		font: 600 10px var(--font-num);
		fill: var(--muted);
	}
</style>
