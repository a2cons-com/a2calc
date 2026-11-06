<script lang="ts">
	import { formatNumber } from '$lib/calc/units';
	import { CMU_WIDTHS, groutVolume, type CmuWidth } from '$lib/takeoff/grout';
	import { grout as st } from '$lib/stores/app.svelte';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import GroutSketch from '$lib/components/GroutSketch.svelte';

	const SPACINGS = [0, 16, 24, 32, 40, 48];
	const r = $derived(groutVolume(st));
	const solid = $derived(!st.spacingIn);
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
		{#if r.cells !== null}<span>Cells grouted</span><span>{r.cells}</span>{/if}
		<span>Blocks (no waste)</span><span>{r.blocks.toLocaleString('en-US')}</span>
	</ResultCard>

	<div class="card sketch">
		<GroutSketch lengthIn={r.netLengthIn} heightIn={st.heightIn} spacingIn={st.spacingIn} />
	</div>

	<div class="section-title">Block</div>
	<div class="seg">
		{#each CMU_WIDTHS as w (w)}
			<button class:on={st.width === w} onclick={() => (st.width = w as CmuWidth)}>{w}″</button>
		{/each}
	</div>

	<div class="section-title">Wall</div>
	<div class="fields">
		<Field label="Total length" bind:value={st.lengthIn} bare="ft" min={0} />
		<div class="seg">
			<button class:on={st.outside} onclick={() => (st.outside = true)}>Outside face</button>
			<button class:on={!st.outside} onclick={() => (st.outside = false)}>Centerline</button>
		</div>
		<Field label="Height" bind:value={st.heightIn} bare="ft" min={0} />
		<Field label="Corners" kind="number" bind:value={st.corners} integer min={0} max={200} note={st.outside ? 'One block width comes off per corner' : ''} />
	</div>

	<div class="section-title">Grouted cells</div>
	<div class="seg spacing">
		{#each SPACINGS as s (s)}
			<button class:on={st.spacingIn === s} onclick={() => (st.spacingIn = s)}>{s ? `${s}″` : 'Solid'}</button>
		{/each}
	</div>
	<div class="fields gap">
		{#if solid}
			<Field label="Openings" kind="number" bind:value={st.openingsSf} suffix="sq ft" min={0} note="Doors and windows: no cells there" />
		{:else}
			<Field label="Ends and jambs" kind="number" bind:value={st.ends} integer min={0} max={500} note="A grouted cell at each wall end and jamb" />
			<Field label="Cells at each corner" kind="number" bind:value={st.cellsPerCorner} integer min={0} max={6} />
			<Field label="Openings (blocks only)" kind="number" bind:value={st.openingsSf} suffix="sq ft" min={0} />
		{/if}
	</div>

	<div class="section-title">Allowances</div>
	<div class="fields">
		<Field label="Waste" kind="number" bind:value={st.wastePct} suffix="%" min={0} max={50} note="The TEK table assumes 3%" />
		<Field label="Pump and hose" kind="number" bind:value={st.pumpYd3} suffix="yd" min={0} max={5} note="0 when bucketed" />
	</div>

	<div class="section-title">Source</div>
	<div class="card fine source">
		<p>
			Grout volumes are based on Table 3 of <a href="https://www.cmha.org/resource/tek-04-02a/" target="_blank" rel="noopener">TEK 4-2A, <i>Estimating Concrete Masonry Materials</i></a>,
			a technical note from the Concrete Masonry &amp; Hardscapes Association (CMHA, formerly NCMA). It is industry estimating guidance, not a code or standard.
		</p>
		<p>
			The table gives cubic feet of grout per 100 sq ft of wall for hollow two-core block, every cell filled, 3% waste included. A2 Calc takes the net volume
			per cell from it and counts cells for partial grouting; your waste goes on top. Rebar, bond beams and lintels are not included.
		</p>
		<p>A2 Calc is not affiliated with or endorsed by CMHA.</p>
	</div>
</div>

<style>
	.sketch {
		margin-top: 12px;
		padding: 12px;
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
