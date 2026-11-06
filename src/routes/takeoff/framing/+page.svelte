<script lang="ts">
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { frameWall, HEADER_SIZES, PRECUTS, SPACINGS, STUD_SIZES, type Opening, type Run } from '$lib/takeoff/framing';
	import { prefs, wall as st, newId } from '$lib/stores/app.svelte';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import WallElevation from '$lib/components/WallElevation.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const r = $derived(frameWall(st));
	const den = $derived(prefs.precision);
	const ft = (v: number) => formatFtIn(v, den);
	const totalLength = $derived(st.runs.reduce((s, x) => s + x.length, 0));
	const verticals = $derived(r.cuts.filter((c) => ['stud', 'corner', 'king'].includes(c.role)).reduce((s, c) => s + c.count, 0));
	const openings = $derived(st.runs.reduce((s, x) => s + x.openings.length, 0));
	/** Heights that take a precut stud with three plates (8', 9', 10'). */
	const HEIGHTS = PRECUTS.map((p) => ({ h: p + 4.5, label: `${Math.round((p + 4.5) / 12)}′` }));

	function addRun() {
		st.runs.push({ id: newId(), length: 120, openings: [] });
	}
	function addOpening(run: Run, kind: Opening['kind']) {
		run.openings.push(
			kind === 'door'
				? { id: newId(), kind, width: 38, height: 82.5, sill: 0, offset: null, header: '2x10' }
				: { id: newId(), kind, width: 36, height: 48, sill: 36, offset: null, header: '2x10' }
		);
	}
	const ROLE_NAME: Record<string, string> = {
		stud: 'Studs', corner: 'Corner backers', king: 'King studs', jack: 'Jack studs', cripple: 'Cripples',
		header: 'Header plies', sill: 'Sills', 'top plate': 'Top plate', 'bottom plate': 'Bottom plate'
	};
</script>

<svelte:head><title>Stud wall · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Stud wall" />

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

	{#each st.runs as run, i (run.id)}
		{@const rf = r.runs[i]}
		<div class="section-title run-title">
			<span>Wall {i + 1}</span>
			{#if st.runs.length > 1}
				<button class="btn quiet small" onclick={() => st.runs.splice(i, 1)}><Icon name="trash" size={16} /> Remove</button>
			{/if}
		</div>
		<div class="card run">
			{#if rf}<WallElevation {rf} height={st.height} />{/if}
			<Field label="Length" bind:value={run.length} bare="ft" min={12} max={2400} />
			{#each run.openings as o, j (o.id)}
				<div class="opening">
					<div class="op-head">
						<div class="seg kind">
							<button class:on={o.kind === 'door'} onclick={() => { o.kind = 'door'; o.sill = 0; }}>Door</button>
							<button class:on={o.kind === 'window'} onclick={() => { o.kind = 'window'; if (!o.sill) o.sill = 36; }}>Window</button>
						</div>
						<button class="icon-btn" onclick={() => run.openings.splice(j, 1)} aria-label="Remove opening"><Icon name="close" size={18} /></button>
					</div>
					<div class="grid2">
						<Field label="RO width" bind:value={o.width} bare="in" min={6} max={run.length} />
						<Field label="RO height" bind:value={o.height} bare="in" min={6} max={st.height} />
						{#if o.kind === 'window'}
							<Field label="Sill height" bind:value={o.sill} bare="in" min={0} max={st.height} />
						{/if}
						<Field label="From left" value={o.offset ?? (run.length - o.width) / 2} onchange={(v) => (o.offset = v)} bare="in" min={0} max={run.length} note={o.offset === null ? 'centered' : ''} />
					</div>
					<div class="op-foot">
						<span class="mini">Header</span>
						<div class="seg hdr">
							{#each HEADER_SIZES as h (h)}<button class:on={o.header === h} onclick={() => (o.header = h)}>{h}</button>{/each}
						</div>
					</div>
				</div>
			{/each}
			<div class="add-row">
				<button class="btn" onclick={() => addOpening(run, 'door')}><Icon name="plus" size={16} /> Door</button>
				<button class="btn" onclick={() => addOpening(run, 'window')}><Icon name="plus" size={16} /> Window</button>
			</div>
		</div>
	{/each}

	<div class="add-run">
		<button class="btn solid" onclick={addRun}><Icon name="plus" size={18} /> Turn a corner, add a wall</button>
		{#if st.runs.length > 2}
			<label class="toggle"><input type="checkbox" bind:checked={st.closed} /> Last wall closes back to the first</label>
		{/if}
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
	.run-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.btn.small {
		padding: 4px 8px;
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: 0;
	}
	.run {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.run :global(.field) {
		background: var(--bg);
	}
	.opening {
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.op-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.op-head .kind {
		flex: 1;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.grid2 :global(.field) {
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 9px 12px;
	}
	.op-foot {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.op-foot .hdr {
		flex: 1;
	}
	.add-row {
		display: flex;
		gap: 8px;
	}
	.add-row .btn {
		flex: 1;
	}
	.add-run {
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.add-run .btn {
		padding: 14px;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.92rem;
		color: var(--muted);
		padding: 0 4px;
	}
	.toggle input {
		width: 20px;
		height: 20px;
		accent-color: var(--primary);
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
