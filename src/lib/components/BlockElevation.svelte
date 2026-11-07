<script lang="ts">
	// One block wall in elevation: courses in running bond around its doors
	// and windows, grouted cells and lintels shaded (from wallGrout, the
	// same cells the volume counts), the length under it. Doors and windows
	// can be dragged along it (OpeningHandles).
	import { formatFtIn } from '$lib/calc/units';
	import { COURSE_IN, UNIT_IN, type WallGrout } from '$lib/takeoff/grout';
	import type { PlanWall } from '$lib/takeoff/plan';
	import { prefs } from '$lib/stores/app.svelte';
	import OpeningHandles from './OpeningHandles.svelte';

	let {
		wall,
		height,
		spacingIn,
		grout,
		poured = false,
		onmove,
		range
	}: {
		wall: PlanWall;
		height: number;
		spacingIn: number;
		grout: WallGrout;
		/** Lintels formed and poured: concrete in place of block. */
		poured?: boolean;
		onmove?: (id: number, offset: number) => void;
		range?: (id: number) => [number, number];
	} = $props();

	const L = $derived(Math.max(UNIT_IN, wall.length));
	const courses = $derived(Math.max(1, Math.round(Math.max(COURSE_IN, height) / COURSE_IN)));
	const H = $derived(courses * COURSE_IN);
	const s = $derived(Math.max(L, H));
	const pad = $derived(s * 0.03);
	const fs = $derived(Math.max(5, s * 0.038));
	const sw = $derived(s / 600);
	const holes = $derived(grout.holes);
	const solid = $derived(!spacingIn || spacingIn <= COURSE_IN);
	const y = (yy: number, h: number) => H - yy - h;

	/** [left, right] minus the openings that cross the band [y0, y1]. */
	function cut(a: number, b: number, y0: number, y1: number): [number, number][] {
		let out: [number, number][] = [[a, b]];
		const gone = poured ? [...holes, ...grout.lintels.map((l) => [l.a, l.b, l.y0, l.y1] as const)] : holes;
		for (const [h0, h1, hb, ht] of gone) {
			if (hb >= y1 - 0.01 || ht <= y0 + 0.01) continue;
			out = out.flatMap(([x0, x1]) => (h1 <= x0 || h0 >= x1 ? [[x0, x1]] : ([[x0, Math.min(x1, h0)], [Math.max(x0, h1), x1]] as [number, number][]).filter(([p, q]) => q - p > 0.5)));
		}
		return out;
	}
	const rows = $derived(
		Array.from({ length: courses }, (_, k) => {
			const out: [number, number][] = [];
			for (let x = k % 2 ? -UNIT_IN / 2 : 0; x < L; x += UNIT_IN) out.push(...cut(Math.max(0, x), Math.min(L, x + UNIT_IN), k * COURSE_IN, (k + 1) * COURSE_IN));
			return out;
		})
	);
	const handles = $derived(
		wall.run.openings.map((o, i) => ({ id: o.id, kind: o.kind, a: holes[i][0], b: holes[i][1], bottom: holes[i][2], head: holes[i][3] }))
	);
	const minWidth = $derived(Math.round((L + pad * 2) * 2));
</script>

<div class="scroll">
	<svg viewBox="{-pad} {-pad} {L + pad * 2} {H + pad * 2 + fs * 1.8}" style="min-width:{minWidth}px" role="img" aria-label="Block wall elevation">
		{#each holes as [a, b, hb, ht], i (i)}
			<rect x={a} y={y(hb, ht - hb)} width={b - a} height={ht - hb} fill="var(--opening)" stroke="var(--opening-edge)" stroke-width={sw} stroke-dasharray="{s / 120} {s / 160}" />
		{/each}
		{#each rows as row, k (k)}
			{#each row as [a, b], j (j)}
				<rect x={a} y={y(k * COURSE_IN, COURSE_IN)} width={b - a} height={COURSE_IN} fill="var(--cmu)" stroke="var(--cmu-edge)" stroke-width={sw} />
			{/each}
		{/each}
		{#each grout.columns as c, i (i)}
			<rect x={c.x - COURSE_IN * 0.28} y={y(c.y0, c.y1 - c.y0)} width={COURSE_IN * 0.56} height={c.y1 - c.y0} fill="var(--grout)" opacity={solid ? 0.55 : 0.85} rx={sw * 2} />
		{/each}
		{#each grout.lintels as l, i (i)}
			<rect x={l.a} y={y(l.y0, l.y1 - l.y0)} width={l.b - l.a} height={l.y1 - l.y0} fill={poured ? 'var(--concrete)' : 'var(--grout)'} opacity={poured ? 1 : 0.75} stroke="var(--primary)" stroke-width={sw * 1.5} />
			<text x={(l.a + l.b) / 2} y={y(l.y0, (l.y1 - l.y0) / 2)} font-size={Math.min(fs * 0.8, (l.y1 - l.y0) * 0.7)} class="lintel" class:poured text-anchor="middle" dominant-baseline="central">{poured ? 'Poured lintel' : 'Lintel'}</text>
		{/each}
		<OpeningHandles {handles} floor={H} {fs} {s} {onmove} {range} step={COURSE_IN} />
		<line x1="0" x2={L} y1={H + pad} y2={H + pad} stroke="var(--faint)" stroke-width={sw} />
		<line x1="0" x2="0" y1={H + pad * 0.5} y2={H + pad * 1.5} stroke="var(--faint)" stroke-width={sw} />
		<line x1={L} x2={L} y1={H + pad * 0.5} y2={H + pad * 1.5} stroke="var(--faint)" stroke-width={sw} />
		<text x={L / 2} y={H + pad + fs * 1.3} text-anchor="middle" font-size={fs} class="dim">{formatFtIn(wall.length, prefs.precision)}</text>
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
	.lintel {
		font-family: var(--font);
		font-weight: 700;
		fill: var(--surface);
	}
	.lintel.poured {
		fill: var(--primary-text);
	}
	.dim {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
</style>
