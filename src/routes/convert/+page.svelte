<script lang="ts">
	import { p } from '$lib/paths';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import { goto } from '$app/navigation';
	import * as C from '$lib/calc/calculator';
	import { formatFtIn, formatNumber, fromUnit, toUnit, UNITS, UNITS_BY_DIM, type Quantity, type UnitId } from '$lib/calc/units';
	import { calc, prefs, convert as st } from '$lib/stores/app.svelte';
	import Field from '$lib/components/Field.svelte';


	const den = $derived(prefs.precision);
	const dec = (x: number) => formatNumber(x, Math.abs(x) >= 1000 ? 2 : 4);

	interface Row {
		label: string;
		text: string;
		q: Quantity;
	}

	const lengthRows = (inches: number): Row[] => {
		const q: Quantity = { v: inches, d: 1 };
		return [
			{ label: 'Feet-inches', text: formatFtIn(inches, den), q },
			{ label: 'Inches', text: formatFtIn(inches, den, true), q },
			{ label: 'Decimal feet', text: `${dec(inches / 12)} ft`, q },
			{ label: 'Decimal inches', text: `${dec(inches)} in`, q },
			{ label: 'Yards', text: `${dec(inches / 36)} yd`, q },
			{ label: 'Meters', text: `${dec(toUnit(q, 'm'))} m`, q },
			{ label: 'Millimeters', text: `${formatNumber(toUnit(q, 'mm'), 1)} mm`, q }
		];
	};
	const unitRows = (q: Quantity, d: 2 | 3): Row[] => UNITS_BY_DIM[d].map((u) => ({ label: UNITS[u].name, text: `${dec(toUnit(q, u))} ${UNITS[u].label}`, q }));

	const rows = $derived.by((): Row[] => {
		if (st.mode === 'length') return lengthRows(st.lengthIn);
		if (st.mode === 'area') return unitRows(fromUnit(st.area, st.areaUnit), 2);
		if (st.mode === 'volume') return unitRows(fromUnit(st.volume, st.volumeUnit), 3);
		return [];
	});

	const dimArea = $derived<Quantity>({ v: st.dl * st.dw, d: 2 });
	const dimVol = $derived<Quantity>({ v: st.dl * st.dw * st.dd, d: 3 });

	function use(q: Quantity) {
		calc.s = C.insert(calc.s, q, den);
		goto(p('/'));
	}
</script>

<svelte:head><title>Convert · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Convert" />

	<div class="seg">
		<button class:on={st.mode === 'length'} onclick={() => (st.mode = 'length')}>Length</button>
		<button class:on={st.mode === 'area'} onclick={() => (st.mode = 'area')}>Area</button>
		<button class:on={st.mode === 'volume'} onclick={() => (st.mode = 'volume')}>Volume</button>
		<button class:on={st.mode === 'dims'} onclick={() => (st.mode = 'dims')}>L×W×D</button>
	</div>

	<div class="input">
		{#if st.mode === 'length'}
			<Field label="Length" bind:value={st.lengthIn} bare="in" min={0} />
		{:else if st.mode === 'area'}
			<Field label="Area" kind="number" bind:value={st.area} suffix={UNITS[st.areaUnit].label} min={0} />
			<div class="units">
				{#each UNITS_BY_DIM[2] as u (u)}
					<button class="pill" class:on={st.areaUnit === u} onclick={() => (st.areaUnit = u)}>{UNITS[u].label}</button>
				{/each}
			</div>
		{:else if st.mode === 'volume'}
			<Field label="Volume" kind="number" bind:value={st.volume} suffix={UNITS[st.volumeUnit].label} min={0} />
			<div class="units">
				{#each UNITS_BY_DIM[3] as u (u)}
					<button class="pill" class:on={st.volumeUnit === u} onclick={() => (st.volumeUnit = u)}>{UNITS[u].label}</button>
				{/each}
			</div>
		{:else}
			<div class="stack">
				<Field label="Length" bind:value={st.dl} bare="ft" min={0} />
				<Field label="Width" bind:value={st.dw} bare="ft" min={0} />
				<Field label="Depth / thickness" bind:value={st.dd} bare="in" min={0} />
			</div>
		{/if}
	</div>

	{#if st.mode === 'dims'}
		<div class="section-title">Area (length × width)</div>
		<div class="card rows">
			{#each unitRows(dimArea, 2) as r (r.label)}
				<button class="row" onclick={() => use(r.q)}><span>{r.label}</span><span class="num">{r.text}</span></button>
			{/each}
		</div>
		<div class="section-title">Volume (× depth)</div>
		<div class="card rows">
			{#each unitRows(dimVol, 3) as r (r.label)}
				<button class="row" onclick={() => use(r.q)}><span>{r.label}</span><span class="num">{r.text}</span></button>
			{/each}
		</div>
	{:else}
		<div class="section-title">Equals</div>
		<div class="card rows">
			{#each rows as r (r.label)}
				<button class="row" onclick={() => use(r.q)}><span>{r.label}</span><span class="num">{r.text}</span></button>
			{/each}
		</div>
	{/if}
	<p class="fine tip">Tap a line to take it to the calculator.</p>
</div>

<style>
	.input {
		margin-top: 16px;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.units {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}
	.rows {
		padding: 4px 0;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		text-align: left;
	}
	.row + .row {
		border-top: 1px solid var(--border);
	}
	.row:active {
		background: var(--surface-2);
	}
	.row span:first-child {
		color: var(--muted);
	}
	.row .num {
		font-size: 1.15rem;
		font-weight: 600;
		text-align: right;
	}
	.tip {
		text-align: center;
		margin-top: 12px;
	}
</style>
