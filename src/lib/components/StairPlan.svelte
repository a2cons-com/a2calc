<script lang="ts">
	// The stair from above, turns and all: treads and landings (tap one to
	// pick it), the floor opening (dashed), an arrow up each flight; the
	// overall length and width dimensioned, each landing's size marked.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import { rectToPlan, toPlan, type Rect, type StairInput, type StairResult, type V2 } from '$lib/takeoff/stairs';

	let { r, selected = -1, onselect }: { input?: StairInput; r: StairResult; selected?: number; onselect?: (i: number) => void } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const b = $derived.by(() => {
		const t = r.topFloor;
		return { a0: Math.min(r.bounds.a0, t.a0), a1: Math.max(r.bounds.a1, t.a1), c0: Math.min(r.bounds.c0, t.c0), c1: Math.max(r.bounds.c1, t.c1) };
	});
	const big = $derived(Math.max(b.a1 - b.a0, b.c1 - b.c0, 1));
	const fs = $derived(Math.max(4, big * 0.04));
	const sw = $derived(big / 400);
	const off = $derived(fs * 1.7);
	const sb = $derived(r.bounds);

	const treads = $derived(
		r.steps.flatMap((s) => {
			const f = r.flights[s.flight];
			return s.kind === 'tread' ? [rectToPlan(f.o, f.d, { a0: s.x0 - f.x0, a1: s.x1 - f.x0, c0: 0, c1: f.width })] : [];
		})
	);
	const path = (loops: V2[][]) => loops.map((l) => 'M' + l.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L') + 'Z').join('');
	const mid = (q: Rect): V2 => [(q.a0 + q.a1) / 2, (q.c0 + q.c1) / 2];
	/** Middle of a landing's main piece (arriving band). */
	const landMid = (i: number): V2 => {
		const p = r.spots[i];
		return mid(rectToPlan(p.o, p.d, p.rects[0]));
	};
	/** An arrow up a flight, down its middle. */
	const arrow = (i: number) => {
		const f = r.flights[i];
		const a = Math.min(4, f.run * 0.1);
		const z = Math.max(a + 6, f.run - 4);
		const p = toPlan(f.o, f.d, a, f.width / 2);
		const q = toPlan(f.o, f.d, z, f.width / 2);
		const h1 = toPlan(f.o, f.d, z - fs * 0.7, f.width / 2 - fs * 0.5);
		const h2 = toPlan(f.o, f.d, z - fs * 0.7, f.width / 2 + fs * 0.5);
		return { p, q, head: `${h1[0]},${h1[1]} ${q[0]},${q[1]} ${h2[0]},${h2[1]}` };
	};
</script>

{#snippet tick(x: number, y: number)}
	<line x1={x - fs * 0.3} y1={y + fs * 0.3} x2={x + fs * 0.3} y2={y - fs * 0.3} class="dl" stroke-width={sw * 2} />
{/snippet}

<svg viewBox="{b.a0 - off * 1.8} {b.c0 - off * 1.8} {b.a1 - b.a0 + off * 3} {b.c1 - b.c0 + off * 3.4}" role="img" aria-label="Stair plan">
	<rect x={r.topFloor.a0} y={r.topFloor.c0} width={r.topFloor.a1 - r.topFloor.a0} height={r.topFloor.c1 - r.topFloor.c0} class="floor" stroke-width={sw} />
	{#each treads as q, i (i)}
		<rect x={q.a0} y={q.c0} width={q.a1 - q.a0} height={q.c1 - q.c0} class="tread" stroke-width={sw} />
	{/each}
	{#each r.spots as p, i (i)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<path d={path(p.outline)} class="landing" class:sel={selected === i} stroke-width={sw} onclick={() => onselect?.(i)} />
		{@const m = landMid(i)}
		<text x={m[0]} y={m[1] - fs * 0.15} font-size={fs * 0.75} class="lbl" text-anchor="middle" pointer-events="none">LANDING {i + 1}</text>
		<text x={m[0]} y={m[1] + fs * 0.8} font-size={fs * 0.65} class="sub" text-anchor="middle" pointer-events="none">{ft(p.size[0])} × {ft(p.size[1])}</text>
	{/each}
	{#if r.openingPlan.loops.length}
		<path d={path(r.openingPlan.loops)} class="open" stroke-width={sw * 1.4} stroke-dasharray="{fs * 0.6} {fs * 0.4}" fill="none" />
	{/if}
	{#each r.flights as f, i (i)}
		{#if f.run > 8}
			{@const a = arrow(i)}
			<line x1={a.p[0]} y1={a.p[1]} x2={a.q[0]} y2={a.q[1]} class="arrow" stroke-width={sw * 2} />
			<polyline points={a.head} class="arrow" stroke-width={sw * 2} fill="none" />
			{#if i === 0}
				<text x={a.p[0]} y={a.p[1] - fs * 0.5} font-size={fs * 0.85} class="lbl">UP</text>
			{/if}
		{/if}
	{/each}
	<!-- overall length along the top, width down the left -->
	<line x1={sb.a0} x2={sb.a1} y1={b.c0 - off} y2={b.c0 - off} class="dl" stroke-width={sw} />
	{@render tick(sb.a0, b.c0 - off)}{@render tick(sb.a1, b.c0 - off)}
	<text x={(sb.a0 + sb.a1) / 2} y={b.c0 - off - fs * 0.45} font-size={fs} class="dt" text-anchor="middle">{ft(sb.a1 - sb.a0)}</text>
	<line x1={b.a0 - off} x2={b.a0 - off} y1={sb.c0} y2={sb.c1} class="dl" stroke-width={sw} />
	{@render tick(b.a0 - off, sb.c0)}{@render tick(b.a0 - off, sb.c1)}
	<text x={b.a0 - off - fs * 0.5} y={(sb.c0 + sb.c1) / 2} font-size={fs} class="dt" text-anchor="middle" transform="rotate(-90 {b.a0 - off - fs * 0.5} {(sb.c0 + sb.c1) / 2})">{ft(sb.c1 - sb.c0)}</text>
	{#if r.openingPlan.size[0] > 0}
		<text x={(b.a0 + b.a1) / 2} y={b.c1 + fs * 1.6} font-size={fs * 0.8} class="ot" text-anchor="middle">
			Opening {r.turns ? `${ft(r.openingPlan.size[0])} × ${ft(r.openingPlan.size[1])}` : ft(r.opening)}
		</text>
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: var(--drawing-h, 300px);
	}
	.tread {
		fill: var(--wood);
		stroke: var(--wood-edge);
	}
	.landing {
		fill: var(--wood-king);
		stroke: var(--wood-edge);
		cursor: pointer;
	}
	.landing.sel {
		stroke: var(--primary);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
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
	.sub {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
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
