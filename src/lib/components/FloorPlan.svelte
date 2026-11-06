<script lang="ts">
	// The walls from above, dimensioned: every wall's length outside the
	// room, and for the selected wall a dimension string inside (to each
	// door and window edge). Doors show their swing, windows their glass.
	// Tap a wall to select it.
	import { formatFtIn } from '$lib/calc/units';
	import { at, corners, type Plan, type PlanWall, type Vec } from '$lib/takeoff/plan';
	import { place } from '$lib/takeoff/framing';
	import { prefs } from '$lib/stores/app.svelte';

	let {
		plan,
		height,
		selected,
		onselect,
		material = 'wood'
	}: {
		plan: Plan;
		/** Wall height, for placing openings (a window's head is clipped to it). */
		height: number;
		selected: number;
		onselect?: (id: number) => void;
		/** Wall color: wood framing or concrete block. */
		material?: 'wood' | 'block';
	} = $props();

	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const t = $derived(plan.depth);
	const [x0, y0, x1, y1] = $derived(plan.box);
	const s = $derived(Math.max(x1 - x0, y1 - y0, 48));
	const fs = $derived(s * 0.042);
	/** Outside dimension line, from the wall's outside face. */
	const off = $derived(fs * 2.2);
	/** Inside dimension string, from the wall's inside face. */
	const offIn = $derived(fs * 1.9);
	const m = $derived(off + fs * 1.6);
	const view = $derived(`${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`);
	const sw = $derived(s / 500);

	const pts = (ps: Vec[]) => ps.map((p) => p.join(',')).join(' ');
	/** Text angle along a wall, never upside down. */
	function angle(w: PlanWall) {
		let a = (Math.atan2(w.d[1], w.d[0]) * 180) / Math.PI;
		if (a > 90.01) a -= 180;
		if (a <= -90.01) a += 180;
		return a;
	}
	function chain(w: PlanWall): number[] {
		const xs = [0, w.length];
		for (const p of place(w.run, height)) xs.push(p.a, p.b);
		return [...new Set(xs.map((x) => Math.round(x * 64) / 64))].sort((a, b) => a - b);
	}
</script>

{#snippet dim(w: PlanWall, a: number, b: number, across: number, label: string, cls: string)}
	{@const p = at(w, a, across)}
	{@const q = at(w, b, across)}
	{@const c = at(w, (a + b) / 2, across + Math.sign(across) * fs * 0.75)}
	{@const tick = fs * 0.35}
	<line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} class="dl {cls}" stroke-width={sw} />
	{#each [a, b] as e (e)}
		{@const u = at(w, e, across - tick)}
		{@const v = at(w, e, across + tick)}
		{@const k = at(w, e - tick * 0.7, across - tick * 0.7)}
		{@const l = at(w, e + tick * 0.7, across + tick * 0.7)}
		<line x1={u[0]} y1={u[1]} x2={v[0]} y2={v[1]} class="dl {cls}" stroke-width={sw} />
		<line x1={k[0]} y1={k[1]} x2={l[0]} y2={l[1]} class="dl {cls}" stroke-width={sw * 2} />
	{/each}
	<text x={c[0]} y={c[1]} transform="rotate({angle(w)} {c[0]} {c[1]})" font-size={fs} class="dt {cls}" text-anchor="middle" dominant-baseline="middle">{label}</text>
{/snippet}

<svg viewBox={view} class={material} role="img" aria-label="Floor plan of the walls">
	{#each plan.walls as w, i (w.run.id)}
		{@const on = w.run.id === selected}
		{@const ops = place(w.run, height)}
		<!-- extension lines to the outside dimension -->
		{#each [0, w.length] as e (e)}
			{@const p = at(w, e, -fs * 0.4)}
			{@const q = at(w, e, -off - fs * 0.4)}
			<line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} class="ext" stroke-width={sw * 0.8} />
		{/each}
		{@render dim(w, 0, w.length, -off, ft(w.length), on ? 'on' : '')}

		<g
			class="wall"
			class:on
			role="button"
			tabindex="0"
			aria-label="Wall {i + 1}"
			onclick={() => onselect?.(w.run.id)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onselect?.(w.run.id)}
		>
			<polygon points={pts(corners(w, t))} class="body" stroke-width={sw} />
			{#each ops as o (o.o.id)}
				<polygon points={pts([at(w, o.a), at(w, o.b), at(w, o.b, t), at(w, o.a, t)])} class="gap" />
				{#if o.o.kind === 'door'}
					{@const h = at(w, o.a, t)}
					{@const leaf = at(w, o.a, t + (o.b - o.a))}
					{@const strike = at(w, o.b, t)}
					<line x1={h[0]} y1={h[1]} x2={leaf[0]} y2={leaf[1]} class="door" stroke-width={sw * 2} />
					<path d="M {strike[0]} {strike[1]} A {o.b - o.a} {o.b - o.a} 0 0 1 {leaf[0]} {leaf[1]}" class="swing" stroke-width={sw} />
				{:else}
					{#each [t * 0.35, t * 0.65] as g (g)}
						{@const p = at(w, o.a, g)}
						{@const q = at(w, o.b, g)}
						<line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} class="glass" stroke-width={sw} />
					{/each}
					{#each [o.a, o.b] as e (e)}
						{@const p = at(w, e)}
						{@const q = at(w, e, t)}
						<line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} class="jamb" stroke-width={sw} />
					{/each}
				{/if}
			{/each}
			<!-- a wider, invisible target than the wall itself -->
			<line x1={at(w, 0, t / 2)[0]} y1={at(w, 0, t / 2)[1]} x2={at(w, w.length, t / 2)[0]} y2={at(w, w.length, t / 2)[1]} class="hit" stroke-width={fs * 2.4} />
		</g>

		{#if on}
			{@const xs = chain(w)}
			{#if xs.length > 2}
				{#each xs.slice(1) as b, k (k)}
					{@const a = xs[k]}
					{#if b - a > 0.01}
						{@render dim(w, a, b, t + offIn, b - a > fs * 3 ? ft(b - a) : '', 'in')}
					{/if}
				{/each}
			{/if}
		{/if}
		{@const tag = at(w, w.length / 2, t + (on && chain(w).length > 2 ? offIn + fs * 2.1 : fs * 1.3))}
		<g class="tag" class:on>
			<circle cx={tag[0]} cy={tag[1]} r={fs * 0.75} />
			<text x={tag[0]} y={tag[1]} font-size={fs * 0.9} text-anchor="middle" dominant-baseline="central">{i + 1}</text>
		</g>
	{/each}

	{#if plan.gap}
		<line x1={plan.gap.from[0]} y1={plan.gap.from[1]} x2={plan.gap.to[0]} y2={plan.gap.to[1]} class="miss" stroke-width={sw * 2} stroke-dasharray="{fs * 0.5} {fs * 0.35}" />
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		max-height: 380px;
		display: block;
		user-select: none;
		-webkit-user-select: none;
	}
	.body {
		fill: var(--wood);
		stroke: var(--wood-edge);
	}
	.block .body {
		fill: var(--cmu);
		stroke: var(--cmu-edge);
	}
	.wall {
		cursor: pointer;
		outline: none;
	}
	.wall.on .body {
		fill: var(--primary);
		stroke: var(--primary);
	}
	.gap {
		fill: var(--surface);
	}
	.door,
	.jamb {
		stroke: var(--muted);
	}
	.swing {
		fill: none;
		stroke: var(--faint);
	}
	.glass {
		stroke: var(--opening-edge);
	}
	.hit {
		stroke: transparent;
	}
	.ext {
		stroke: var(--border);
	}
	.dl {
		stroke: var(--faint);
	}
	.dl.on,
	.dl.in {
		stroke: var(--primary-text);
	}
	.dt {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
	.dt.on,
	.dt.in {
		fill: var(--primary-text);
	}
	.dt.in {
		font-weight: 500;
	}
	.tag circle {
		fill: var(--surface-2);
	}
	.tag text {
		font-family: var(--font);
		font-weight: 700;
		fill: var(--muted);
	}
	.tag.on circle {
		fill: var(--primary);
	}
	.tag.on text {
		fill: var(--primary-ink);
	}
	.miss {
		stroke: var(--danger);
	}
</style>
