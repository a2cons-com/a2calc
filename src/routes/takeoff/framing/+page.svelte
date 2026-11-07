<script lang="ts">
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { frameWall, LUMBER, moveRange, HEADER_SIZES, PRECUTS, SPACINGS, STUD_SIZES } from '$lib/takeoff/framing';
	import { prefs, wall as st } from '$lib/stores/app.svelte';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ProjectBar from '$lib/components/ProjectBar.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import WallElevation from '$lib/components/WallElevation.svelte';
	import PlanCard from '$lib/components/PlanCard.svelte';
	import WallList from '$lib/components/WallList.svelte';
	import { framingScene } from '$lib/takeoff/scene';
	import { planWalls } from '$lib/takeoff/plan';

	const r = $derived(frameWall(st));
	const den = $derived(prefs.precision);
	const ft = (v: number) => formatFtIn(v, den);
	const totalLength = $derived(st.runs.reduce((s, x) => s + x.length, 0));
	const verticals = $derived(r.cuts.filter((c) => ['stud', 'corner', 'king'].includes(c.role)).reduce((s, c) => s + c.count, 0));
	const openings = $derived(st.runs.reduce((s, x) => s + x.openings.length, 0));
	/** Heights that take a precut stud with three plates (8', 9', 10'). */
	const HEIGHTS = PRECUTS.map((p) => ({ h: p + 4.5, label: `${Math.round((p + 4.5) / 12)}′` }));

	let selectedId = $state<number | null>(null);
	/** The wall being edited: the one picked in the plan, else the first. */
	const sel = $derived(st.runs.find((x) => x.id === selectedId) ?? st.runs[0]);
	const plan = $derived(planWalls(st.runs, LUMBER[st.member]?.[1] ?? 3.5, st.closed));
	const ROLE_NAME: Record<string, string> = {
		stud: 'Studs', corner: 'Corner backers', king: 'King studs', jack: 'Jack studs', cripple: 'Cripples',
		header: 'Header plies', sill: 'Sills', 'top plate': 'Top plate', 'bottom plate': 'Bottom plate'
	};
</script>

<svelte:head><title>Stud wall · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Stud wall" />
	<ProjectBar kind="framing" />

	<ResultCard label="Full-height studs" value={String(verticals)} unit="pcs">
		<span>Wall length</span><span>{ft(totalLength)} · {st.runs.length} {st.runs.length === 1 ? 'wall' : 'walls'}</span>
		<span>Stud cut length</span><span>{ft(r.studLength)}</span>
		<span>Plates</span><span>{formatNumber(r.plateLf, 1)} lf</span>
		<span>Openings</span><span>{openings}</span>
		{#if r.corners}<span>Corners</span><span>{r.corners}</span>{/if}
	</ResultCard>

	{#each r.warnings as w (w)}
		<p class="warn">{w}</p>
	{/each}

	<PlanCard {plan} height={st.height} selected={sel?.id ?? -1} onselect={(id) => (selectedId = id)} scene={() => framingScene(r.runs, plan, sel?.id ?? -1)} />

	<WallList walls={st} height={st.height} selected={sel?.id ?? -1} onselect={(id) => (selectedId = id)} header="2x10">
		{#snippet elevation(run, move)}
			{@const rf = r.runs[st.runs.indexOf(run)]}
			{#if rf}<WallElevation {rf} height={st.height} onmove={move} range={(id) => moveRange(run, id, st.height)} />{/if}
		{/snippet}
		{#snippet openingExtra(o)}
			<div class="op-foot">
				<span class="mini">Header</span>
				<div class="seg hdr">
					{#each HEADER_SIZES as h (h)}<button class:on={o.header === h} onclick={() => (o.header = h)}>{h}</button>{/each}
				</div>
			</div>
		{/snippet}
	</WallList>

	<div class="section-title">Framing</div>
	<div class="fields">
		<div class="seg">
			{#each STUD_SIZES as sz (sz)}
				<button class:on={st.member === sz} onclick={() => (st.member = sz)}>{sz}</button>
			{/each}
		</div>
		<div class="seg">
			{#each SPACINGS as sp (sp)}
				<button class:on={st.spacing === sp} onclick={() => (st.spacing = sp)}>{sp}″ o.c.</button>
			{/each}
		</div>
		<Field label="Wall height" bind:value={st.height} bare="ft" min={24} max={480} note="Floor to top of the top plate" />
		<div class="quick">
			{#each HEIGHTS as h (h.h)}
				<button class="pill" class:on={Math.abs(st.height - h.h) < 0.01} onclick={() => (st.height = h.h)}>{h.label} precut · {ft(h.h)}</button>
			{/each}
		</div>
		<div class="two">
			<div>
				<span class="mini">Top plates</span>
				<div class="seg">
					{#each [1, 2] as n (n)}<button class:on={st.topPlates === n} onclick={() => (st.topPlates = n)}>{n === 1 ? 'Single' : 'Double'}</button>{/each}
				</div>
			</div>
			<div>
				<span class="mini">Bottom plates</span>
				<div class="seg">
					{#each [1, 2] as n (n)}<button class:on={st.bottomPlates === n} onclick={() => (st.bottomPlates = n)}>{n === 1 ? 'Single' : 'Double'}</button>{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="section-title">Cut list</div>
	<div class="card table">
		{#each r.cuts as c (c.role + c.size + c.length)}
			<div class="tr">
				<span class="what">{ROLE_NAME[c.role]}<small>{c.size}</small></span>
				<span class="num len">{ft(c.length)}</span>
				<span class="num qty">{c.count}</span>
			</div>
		{/each}
	</div>

	<div class="section-title">To buy <span class="hint">+{st.wastePct}% waste</span></div>
	<div class="card table">
		{#each r.buy as b (b.size + b.feet + b.precut)}
			<div class="tr">
				<span class="what">{b.size}</span>
				<span class="num len">{b.precut ? `${ft(b.precut)} precut` : `${b.feet}′`}</span>
				<span class="num qty">{b.count}</span>
			</div>
		{/each}
	</div>
	<div class="fields gap">
		<Field label="Waste" kind="number" bind:value={st.wastePct} suffix="%" min={0} max={50} />
		<Field label="Longest plate stock" bind:value={st.stock} bare="ft" min={96} max={288} />
	</div>

	<p class="fine foot">
		Studs on layout from each wall's start with an end stud at both ends, one backer per corner, one king and one jack each side of an opening,
		headers as plies to fill the wall. Size headers from the plans or span tables; this does not check spans or loads. Blocking, fire blocking
		and sheathing are not included.
	</p>
</div>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.fields.gap {
		margin-top: 10px;
	}
	.seg button {
		font-size: 0.85rem;
	}
	.quick {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.quick .pill {
		font-size: 0.8rem;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.mini {
		display: block;
		font-size: 0.78rem;
		color: var(--muted);
		margin: 2px 2px 4px;
	}
	.op-foot {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.op-foot .hdr {
		flex: 1;
	}
	.table {
		padding: 4px 0;
	}
	.tr {
		display: grid;
		grid-template-columns: 1fr auto 3.2rem;
		gap: 10px;
		align-items: baseline;
		padding: 10px 16px;
	}
	.tr + .tr {
		border-top: 1px solid var(--border);
	}
	.what {
		display: flex;
		flex-direction: column;
	}
	.what small {
		color: var(--faint);
		font-size: 0.78rem;
	}
	.len {
		color: var(--muted);
	}
	.qty {
		text-align: right;
		font-weight: 700;
		font-size: 1.1rem;
	}
	.hint {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 500;
		color: var(--faint);
		margin-left: 6px;
	}
	.foot {
		margin: 14px 4px;
	}
</style>
