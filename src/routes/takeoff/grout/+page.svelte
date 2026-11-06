<script lang="ts">
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { actualWidth, CMU_WIDTHS, groutVolume, wallsGrout, wallTotals, type CmuWidth } from '$lib/takeoff/grout';
	import { moveRange } from '$lib/takeoff/framing';
	import { planWalls } from '$lib/takeoff/plan';
	import { blockScene } from '$lib/takeoff/scene';
	import { grout as st, prefs } from '$lib/stores/app.svelte';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import PlanCard from '$lib/components/PlanCard.svelte';
	import WallList from '$lib/components/WallList.svelte';
	import BlockElevation from '$lib/components/BlockElevation.svelte';

	const SPACINGS = [0, 16, 24, 32, 40, 48];
	const r = $derived(groutVolume(st));
	const solid = $derived(!st.spacingIn);
	const totals = $derived(wallTotals(st.runs, st.closed, st.heightIn));
	const plan = $derived(planWalls(st.runs, actualWidth(st.width), st.closed));
	const grid = $derived(wallsGrout(st.runs, st.closed, st.heightIn, st.spacingIn, st.cellsPerCorner));
	let selectedId = $state<number | null>(null);
	const sel = $derived(st.runs.find((x) => x.id === selectedId) ?? st.runs[0]);
	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const yd = (v: number) => formatNumber(v, 2);
	const order = (v: number) => {
		const whole = Math.floor(v);
		const fr = ['', '¼', '½', '¾'][Math.round((v - whole) * 4)];
		return whole || !fr ? `${whole}${fr}` : fr;
	};
</script>

<svelte:head><title>Block fill grout · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Block fill grout" />

	<ResultCard label="Order" value={order(r.orderYd3)} unit="cu yd">
		<span>Grout</span><span>{formatNumber(r.netFt3, 1)} cu ft</span>
		<span>Waste {st.wastePct}%</span><span>{formatNumber(r.wasteFt3, 1)} cu ft</span>
		{#if st.pumpYd3 > 0}<span>Pump and hose</span><span>{yd(st.pumpYd3)} yd</span>{/if}
		<span>Total</span><span>{yd(r.totalYd3)} yd</span>
		{#if r.lintels}<span>Lintels ({r.lintels})</span><span>{formatNumber(r.lintelFt3, 1)} cu ft of the grout</span>{/if}
		{#if r.cells !== null}<span>Cells grouted</span><span>{r.cells}</span>{/if}
		<span>Blocks (no waste)</span><span>{r.blocks.toLocaleString('en-US')}</span>
		<span>Wall length</span><span>{ft(totals.lengthIn)} · {st.runs.length} {st.runs.length === 1 ? 'wall' : 'walls'}</span>
		{#if totals.corners}<span>Corners</span><span>{totals.corners}</span>{/if}
		{#if totals.openingsSf > 0}<span>Openings</span><span>{formatNumber(totals.openingsSf, 1)} sq ft</span>{/if}
	</ResultCard>

	<PlanCard material="block" {plan} height={st.heightIn} selected={sel?.id ?? -1} onselect={(id) => (selectedId = id)} scene={() => blockScene(plan, st.heightIn, st.spacingIn, st.cellsPerCorner, st.closed, sel?.id ?? -1)} />

	<WallList walls={st} height={st.heightIn} selected={sel?.id ?? -1} onselect={(id) => (selectedId = id)} openingLabel="Opening">
		{#snippet elevation(run, move)}
			{@const k = st.runs.indexOf(run)}
			{@const w = plan.walls[k]}
			{#if w && grid[k]}<BlockElevation wall={w} height={st.heightIn} spacingIn={st.spacingIn} grout={grid[k]} onmove={move} range={(id) => moveRange(run, id, st.heightIn)} />{/if}
		{/snippet}
	</WallList>

	<div class="section-title">Block</div>
	<div class="seg">
		{#each CMU_WIDTHS as w (w)}
			<button class:on={st.width === w} onclick={() => (st.width = w as CmuWidth)}>{w}″</button>
		{/each}
	</div>

	<div class="fields gap">
		<Field label="Wall height" bind:value={st.heightIn} bare="ft" min={8} max={480} note="Rounded to whole 8″ courses in the drawing" />
	</div>

	<div class="section-title">Grouted cells</div>
	<div class="seg spacing">
		{#each SPACINGS as s (s)}
			<button class:on={st.spacingIn === s} onclick={() => (st.spacingIn = s)}>{s ? `${s}″` : 'Solid'}</button>
		{/each}
	</div>
	<div class="fields gap">
		{#if solid}
			<p class="fine note">Every cell filled, except at the doors and windows drawn on the walls; the lintels over them are part of it.</p>
		{:else}
			<Field label="Cells at each corner" kind="number" bind:value={st.cellsPerCorner} integer min={0} max={6} />
			<p class="fine note">
				Always grouted, whatever the spacing: the cell each side of every door and window, one cell at a free wall end, and a lintel over each
				opening (8″ deep up to 6′ wide, 16″ wider, bearing 8″ each side).
			</p>
		{/if}
	</div>

	<div class="section-title">Allowances</div>
	<div class="fields">
		<Field label="Waste" kind="number" bind:value={st.wastePct} suffix="%" min={0} max={50} note="The source table includes 3%" />
		<Field label="Pump and hose" kind="number" bind:value={st.pumpYd3} suffix="yd" min={0} max={5} note="0 when bucketed" />
	</div>

	<div class="section-title">Source</div>
	<div class="card fine source">
		<p>
			Grout volumes are based on Table 3 of <a href="https://www.cmha.org/resource/tek-04-02a/" target="_blank" rel="noopener">TEK 4-2A, <i>Estimating Concrete Masonry Materials</i></a>,
			a technical note published by the Concrete Masonry &amp; Hardscapes Association. It is industry estimating guidance, not a code or standard.
		</p>
		<p>
			The table gives cubic feet of grout per 100 sq ft of wall for hollow two-core block, every cell filled, 3% waste included. A2 Calc takes the net volume
			per cell from it and counts cells for partial grouting; your waste goes on top. Rebar, bond beams and lintels are not included.
		</p>
		<p>The publisher is named only to cite the source. A2 Calc is not affiliated with, sponsored or endorsed by it.</p>
	</div>
</div>

<style>
	.note {
		margin: 0 4px;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.fields.gap {
		margin-top: 8px;
	}
	.spacing button {
		font-size: 0.82rem;
		padding: 8px 2px;
	}
	.source p {
		margin: 0 0 8px;
	}
	.source p:last-child {
		margin: 0;
	}
</style>
