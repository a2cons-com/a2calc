<script lang="ts">
	// The floor from above: the walls (tap one to pick it), doorways, every
	// piece as laid (cut ones lighter, slivers red), and the two chalk lines
	// the layout is set out from, each with its distance off its wall.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import type { FloorInput, FloorResult, V2 } from '$lib/takeoff/flooring';

	let { r, input, selected = -1, onselect }: { r: FloorResult; input: FloorInput; selected?: number; onselect?: (i: number) => void } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const bb = $derived(
		r.room.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity])
	);
	const big = $derived(Math.max(bb[2] - bb[0], bb[3] - bb[1], 12));
	const fs = $derived(Math.max(3, big * 0.035));
	const sw = $derived(big / 500);
	const wallT = $derived(Math.max(3, big * 0.018));
	const off = $derived(fs * 2.6);
	const view = $derived(`${bb[0] - off} ${bb[1] - off} ${bb[2] - bb[0] + off * 2} ${bb[3] - bb[1] + off * 2}`);

	const poly = (p: V2[]) => 'M' + p.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join('L') + 'Z';
	const plank = $derived(input.material === 'plank');
	/** One path per look, so thousands of pieces stay light. */
	const paths = $derived.by(() => {
		const out = { a: '', b: '', ac: '', bc: '', thin: '' };
		for (const p of r.pieces) {
			const d = poly(p.poly);
			if (p.thin) out.thin += d;
			else if (p.type === 0) p.cut ? (out.ac += d) : (out.a += d);
			else p.cut ? (out.bc += d) : (out.b += d);
		}
		return out;
	});
	const mid = (a: V2, b: V2): V2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const outer = (i: number, k: number): V2 => {
		const w = r.walls[i];
		const m = mid(w.a, w.b);
		return [m[0] - w.n[0] * k, m[1] - w.n[1] * k];
	};
	const doors = $derived(
		r.walls.flatMap((w, i) =>
			(input.rect && i >= 2 ? input.sides[i] : input.sides[i])?.doors.map((d) => {
				const a: V2 = [w.a[0] + w.d[0] * d.at, w.a[1] + w.d[1] * d.at];
				const b: V2 = [a[0] + w.d[0] * d.width, a[1] + w.d[1] * d.width];
				return { a, b, n: w.n, id: d.id };
			}) ?? []
		)
	);
	const uid = $props.id();
</script>

<svg viewBox={view} role="img" aria-label="Floor layout">
	<defs>
		<clipPath id="lay-{uid}"><path d={poly(r.lay)} /></clipPath>
	</defs>
	<path d={poly(r.room)} class="sub" stroke-width={sw} />
	<g clip-path="url(#lay-{uid})" stroke-width={sw} class:plank>
		<path d={paths.a} class="pa" />
		<path d={paths.ac} class="pa cut" />
		<path d={paths.b} class="pb" />
		<path d={paths.bc} class="pb cut" />
		<path d={paths.thin} class="thin" />
	</g>
	{#if r.approx}
		<text x={(bb[0] + bb[2]) / 2} y={(bb[1] + bb[3]) / 2} font-size={fs} class="note" text-anchor="middle">Mosaic: counted by area</text>
	{/if}
	<!-- walls, outside the inside faces; tap one to pick it -->
	{#each r.walls as w, i (i)}
		{@const o = (k: number): V2 => [-w.n[0] * k, -w.n[1] * k]}
		{@const a = o(wallT / 2)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<line
			x1={w.a[0] + a[0] - w.d[0] * wallT}
			y1={w.a[1] + a[1] - w.d[1] * wallT}
			x2={w.b[0] + a[0] + w.d[0] * wallT}
			y2={w.b[1] + a[1] + w.d[1] * wallT}
			class="wall"
			class:sel={selected === i}
			stroke-width={wallT}
			onclick={() => onselect?.(i)}
		/>
		{@const t = outer(i, wallT + fs * 1.1)}
		<text x={t[0]} y={t[1] + fs * 0.35} font-size={fs * 0.8} class="wl" class:sel={selected === i} text-anchor="middle" pointer-events="none">{i + 1}</text>
	{/each}
	{#each doors as d (d.id)}
		<line x1={d.a[0] - d.n[0] * wallT / 2} y1={d.a[1] - d.n[1] * wallT / 2} x2={d.b[0] - d.n[0] * wallT / 2} y2={d.b[1] - d.n[1] * wallT / 2} class="door" stroke-width={wallT * 1.2} />
	{/each}
	<!-- the chalk lines -->
	{#each r.lines as l, i (i)}
		<line x1={l.p[0]} y1={l.p[1]} x2={l.q[0]} y2={l.q[1]} class="chalk" stroke-width={sw * 3} stroke-dasharray="{fs * 0.7} {fs * 0.35}" />
		<circle cx={l.p[0]} cy={l.p[1]} r={fs * 0.62} class="tag" />
		<text x={l.p[0]} y={l.p[1] + fs * 0.3} font-size={fs * 0.8} class="tagt" text-anchor="middle">{i ? 'B' : 'A'}</text>
	{/each}
</svg>
<div class="legend fine">
	<span><b>A</b> {ft(r.lines[0].dist)} off wall {r.lines[0].side + 1}</span>
	<span><b>B</b> {ft(r.lines[1].dist)} off wall {r.lines[1].side + 1}</span>
	{#if r.smallest !== null}<span>smallest cut {ft(r.smallest)}</span>{/if}
</div>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: var(--drawing-h, 320px);
	}
	.sub {
		fill: var(--bg);
		stroke: var(--border);
	}
	.pa {
		fill: var(--concrete-top);
		stroke: var(--grout);
	}
	.pb {
		fill: var(--cmu);
		stroke: var(--grout);
	}
	.plank .pa,
	.plank .pb {
		fill: var(--wood);
		stroke: var(--wood-edge);
	}
	.cut {
		fill-opacity: 0.55;
	}
	.thin {
		fill: var(--danger);
		fill-opacity: 0.55;
		stroke: var(--danger);
	}
	.wall {
		stroke: var(--muted);
		cursor: pointer;
	}
	.wall.sel {
		stroke: var(--primary);
	}
	.door {
		stroke: var(--surface);
	}
	.wl {
		font-family: var(--font-num);
		font-weight: 700;
		fill: var(--muted);
	}
	.wl.sel {
		fill: var(--primary-text);
	}
	.chalk {
		stroke: var(--primary);
	}
	.tag {
		fill: var(--primary);
	}
	.tagt {
		font-family: var(--font-num);
		font-weight: 800;
		fill: var(--primary-ink);
	}
	.note {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 14px;
		margin: 2px 0 0;
		color: var(--muted);
	}
	.legend b {
		color: var(--primary-text);
	}
</style>
