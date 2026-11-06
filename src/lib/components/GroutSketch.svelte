<script lang="ts">
	// Elevation of the block wall: courses in running bond, grouted cells
	// shaded full height. One straight wall of the net length; corners and
	// jambs are counted in the numbers, not drawn.
	import { formatFtIn } from '$lib/calc/units';
	import { COURSE_IN, groutedCells, UNIT_IN } from '$lib/takeoff/grout';
	import { prefs } from '$lib/stores/app.svelte';

	let { lengthIn, heightIn, spacingIn }: { lengthIn: number; heightIn: number; spacingIn: number } = $props();

	const L = $derived(Math.max(UNIT_IN, lengthIn));
	const H = $derived(Math.max(COURSE_IN, heightIn));
	const courses = $derived(Math.max(1, Math.round(H / COURSE_IN)));
	const cells = $derived(groutedCells(L, spacingIn));
	const solid = $derived(!spacingIn || spacingIn <= COURSE_IN);

	/** Blocks of each course: [x, width]; odd courses start half a unit in. */
	const rows = $derived(
		Array.from({ length: courses }, (_, k) => {
			const out: [number, number][] = [];
			let x = k % 2 ? -UNIT_IN / 2 : 0;
			while (x < L) {
				const a = Math.max(0, x);
				const b = Math.min(L, x + UNIT_IN);
				if (b - a > 0.5) out.push([a, b - a]);
				x += UNIT_IN;
			}
			return out;
		})
	);
	const pad = $derived(Math.max(L, H) * 0.04);
	const vbH = $derived(H + pad * 2 + Math.max(L, H) * 0.09);
	const stroke = $derived(Math.max(L, H) / 400);
	const label = $derived(Math.max(L, H) * 0.045);
</script>

<svg viewBox="{-pad} {-pad} {L + pad * 2} {vbH}" class="wall" role="img" aria-label="Block wall elevation">
	{#each rows as row, k}
		{#each row as [x, w]}
			<rect x={x} y={H - (k + 1) * COURSE_IN} width={w} height={COURSE_IN} fill="var(--cmu)" stroke="var(--cmu-edge)" stroke-width={stroke} />
		{/each}
	{/each}
	{#each cells as g, i}
		{#if g}
			<rect x={i * COURSE_IN + COURSE_IN * 0.22} y={H - courses * COURSE_IN} width={COURSE_IN * 0.56} height={courses * COURSE_IN} fill="var(--grout)" opacity={solid ? 0.55 : 0.85} rx={stroke * 2} />
		{/if}
	{/each}
	<text x={L / 2} y={H + pad + label} text-anchor="middle" class="dim" font-size={label}>{formatFtIn(lengthIn, prefs.precision)}</text>
</svg>

<style>
	.wall {
		width: 100%;
		max-height: 220px;
		display: block;
	}
	.dim {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
</style>
