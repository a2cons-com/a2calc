<script lang="ts">
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { prefs, stairs as st } from '$lib/stores/app.svelte';
	import { codeNotes, CODES, stairCuts, stairs, stringerSpacing, type StairCode, type StringerSize } from '$lib/takeoff/stairs';
	import { stairScene } from '$lib/takeoff/scene';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ProjectBar from '$lib/components/ProjectBar.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import ViewToggle from '$lib/components/ViewToggle.svelte';
	import Zoom from '$lib/components/Zoom.svelte';
	import StairSection from '$lib/components/StairSection.svelte';
	import StairPlan from '$lib/components/StairPlan.svelte';

	const r = $derived(stairs(st));
	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const cuts = $derived(stairCuts(st, r, ft));
	/** Code figures read in inches up to 5′ (34″, not 2′ 10″). */
	const notes = $derived(codeNotes(r.limits, (v) => formatFtIn(v, prefs.precision, v < 60)));

	let view = $state<'section' | 'plan' | '3d'>('section');
	const VIEWS: ['section' | 'plan' | '3d', string][] = [
		['section', 'Section'],
		['plan', 'Plan'],
		['3d', '3D']
	];
	const CODE_IDS = Object.keys(CODES) as StairCode[];
	const SIZES: StringerSize[] = ['2x12', '2x10'];

	function risers(d: number) {
		st.risers = Math.max(1, Math.min(60, r.risers + d));
	}
	function landings(d: number) {
		st.landings = Math.max(0, Math.min(r.risers - 1, r.landings + d));
	}
</script>

<svelte:head><title>Stairs · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Stairs" />
	<ProjectBar kind="stairs" />

	<ResultCard label="Risers" value={String(r.risers)} unit="at {ft(r.riser)}">
		<span>Treads</span><span>{r.treads} at {ft(st.tread)}</span>
		<span>Finished rise</span><span>{ft(r.finishedRise)}</span>
		<span>Total run</span><span>{ft(r.run)}</span>
		{#if r.landings}<span>Landings</span><span>{r.landings} at {ft(st.landingDepth)}</span>{/if}
		<span>Floor opening</span><span>{r.opening > 0 ? `${ft(r.opening)} long` : 'none needed'}</span>
		<span>Angle</span><span>{formatNumber(r.angle, 1)}°</span>
	</ResultCard>

	{#each r.warnings as w (w)}
		<p class="warn">{w}</p>
	{/each}

	<ViewToggle title="Drawing" bind:view views={VIEWS} />
	<div class="card drawing">
		{#if view === 'section'}
			<Zoom><StairSection input={st} {r} /></Zoom>
			<p class="fine hint">Cut down the middle. Dashed: the nosing line, and the headroom above it. Pinch to zoom.</p>
		{:else if view === 'plan'}
			<Zoom><StairPlan input={st} {r} /></Zoom>
			<p class="fine hint">From above. Dashed: the opening in the upper floor.</p>
		{:else}
			{#await import('$lib/components/Scene3D.svelte') then { default: Scene3D }}
				<Scene3D scene={stairScene(st, r)} />
			{/await}
			<p class="fine hint">The upper floor is see-through. Drag to turn, pinch to zoom.</p>
		{/if}
	</div>

	<div class="section-title">Levels</div>
	<div class="fields">
		<div class="seg">
			{#each CODE_IDS as c (c)}
				<button class:on={st.code === c} onclick={() => (st.code = c)}>{CODES[c].name}</button>
			{/each}
		</div>
		<Field label="Rough rise" bind:value={st.rise} bare="ft" min={6} max={480} note="Lower slab or subfloor to upper subfloor" />
		<div class="two">
			<Field label="Finish, bottom" bind:value={st.finishBottom} min={0} max={6} note="Tile, wood, carpet" />
			<Field label="Finish, top" bind:value={st.finishTop} min={0} max={6} note="Still to go on" />
		</div>
		<Field label="Upper floor depth" bind:value={st.floorDepth} min={1} max={48} note="Joists and subfloor, for headroom" />
	</div>

	<div class="section-title">Steps</div>
	<div class="fields">
		<div class="row">
			<span class="label">Risers<small>{st.risers === null ? 'Fewest the code allows' : 'Set by hand'}</small></span>
			<div class="stepper">
				<button class="pill" class:on={st.risers === null} onclick={() => (st.risers = null)}>Auto</button>
				<button class="icon-btn" aria-label="One riser fewer" onclick={() => risers(-1)}>−</button>
				<span class="num count">{r.risers}</span>
				<button class="icon-btn" aria-label="One riser more" onclick={() => risers(1)}>+</button>
			</div>
		</div>
		<Field label="Tread run" bind:value={st.tread} min={4} max={24} note="Nosing to nosing" />
		<div class="two">
			<Field label="Nosing" bind:value={st.nosing} min={0} max={3} />
			<Field label="Width" bind:value={st.width} bare="in" min={12} max={240} />
		</div>
		<div class="two">
			<Field label="Tread stock" bind:value={st.treadThk} min={0} max={4} note="Thickness" />
			<Field label="Riser stock" bind:value={st.riserThk} min={0} max={2} note="0 for open" />
		</div>
	</div>

	<div class="section-title">Landings</div>
	<div class="fields">
		<div class="row">
			<span class="label">Landings<small>{st.landings === null ? 'Only where the code needs one' : 'Set by hand'}</small></span>
			<div class="stepper">
				<button class="pill" class:on={st.landings === null} onclick={() => (st.landings = null)}>Auto</button>
				<button class="icon-btn" aria-label="One landing fewer" onclick={() => landings(-1)}>−</button>
				<span class="num count">{r.landings}</span>
				<button class="icon-btn" aria-label="One landing more" onclick={() => landings(1)}>+</button>
			</div>
		</div>
		<Field label="Landing depth" bind:value={st.landingDepth} min={12} max={240} note="In the direction of travel" />
	</div>

	{#if r.flights.length > 1}
		<div class="section-title">Flights</div>
		<div class="card table">
			{#each r.flights as f, i (i)}
				<div class="tr fl">
					<span class="what">Flight {i + 1}<small>{f.risers} risers · {f.treads} treads</small></span>
					<span class="num pair"><small>Rise</small>{ft(f.rise)}</span>
					<span class="num pair"><small>Run</small>{ft(f.run)}</span>
				</div>
				{#if i < r.flights.length - 1}
					<div class="tr fl landing">
						<span class="what">Landing {i + 1}<small>Framing top +{ft(f.y1 - st.treadThk)} rough</small></span>
						<span class="num pair"><small>Height</small>+{ft(f.y1 - Math.max(0, st.finishBottom))}</span>
						<span class="num pair"><small>Depth</small>{ft(r.flights[i + 1].x0 - f.x1)}</span>
					</div>
				{/if}
			{/each}
			<div class="tr fl total">
				<span class="what">Total</span>
				<span class="num pair"><small>Rise</small>{ft(r.finishedRise)}</span>
				<span class="num pair"><small>Run</small>{ft(r.run)}</span>
			</div>
		</div>
		<p class="fine tip">Heights are to the finished landing surface, from the finished floor below; run is nosing to nosing, first riser to the landing edge.</p>
	{/if}

	<div class="section-title">Stringer layout</div>
	<div class="fields">
		<div class="seg">
			{#each SIZES as sz (sz)}
				<button class:on={st.stringer === sz} onclick={() => (st.stringer = sz)}>{sz}</button>
			{/each}
		</div>
	</div>
	<div class="card table">
		<div class="tr"><span class="what">First rise<small>Bottom, cut short for the tread and finish</small></span><span class="num val">{ft(r.flights[0]?.firstRise ?? 0)}</span></div>
		<div class="tr"><span class="what">Every other rise</span><span class="num val">{ft(r.riser)}</span></div>
		<div class="tr"><span class="what">Tread cut</span><span class="num val">{ft(st.tread)}</span></div>
		<div class="tr"><span class="what">Top<small>Last tread cut below the upper subfloor</small></span><span class="num val">{ft(r.topDrop)}</span></div>
		{#if r.landings}
			<div class="tr"><span class="what">Above a landing<small>First rise from the landing framing</small></span><span class="num val">{ft(r.flights[1]?.firstRise ?? r.riser)}</span></div>
		{/if}
		<div class="tr"><span class="what">Left under the notches<small>Notches cut {ft(r.notch)} deep</small></span><span class="num val">{ft(r.throat)}</span></div>
		<div class="tr"><span class="what">Stringers across<small>At most {stringerSpacing(st.treadThk)}″ apart for this tread stock</small></span><span class="num val">{r.stringers}</span></div>
		{#each r.flights as f, i (i)}
			{#if f.risers > 1}
				<div class="tr"><span class="what">Stringer length{r.flights.length > 1 ? `, flight ${i + 1}` : ''}</span><span class="num val">{ft(f.length)}</span></div>
			{/if}
		{/each}
	</div>

	<div class="section-title">Cut list</div>
	<div class="card table">
		{#each cuts as c (c.what + c.size)}
			<div class="tr three"><span class="what">{c.what}</span><span class="num len">{c.size}</span><span class="num qty">{c.count}</span></div>
		{/each}
	</div>

	{#each r.hints as h (h)}
		<p class="fine tip">{h}</p>
	{/each}

	<div class="section-title">Code reminders · {r.limits.name}</div>
	<ul class="fine code">
		{#each notes as n (n)}<li>{n}</li>{/each}
	</ul>
	<p class="fine foot">
		Risers are figured on the finished rise, so the first and last steps come out even once the finish floors are down. Stringers are not checked for span or load: past about 12′ of run, or under heavy use, ask for a design.
	</p>
</div>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.seg button {
		font-size: 0.85rem;
	}
	.drawing {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
	}
	.hint {
		margin: -4px 0 0;
		text-align: center;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 10px 8px 14px;
		background: var(--field);
		border: 1px solid var(--field-border);
		border-radius: 12px;
		min-height: 52px;
	}
	.label {
		color: var(--muted);
		font-size: 0.95rem;
		display: flex;
		flex-direction: column;
	}
	.label small {
		font-size: 0.75rem;
		color: var(--faint);
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.stepper .icon-btn {
		width: 38px;
		height: 38px;
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--primary-text);
	}
	.stepper .pill {
		font-size: 0.8rem;
		margin-right: 4px;
	}
	.count {
		min-width: 2ch;
		text-align: center;
		font-size: 1.15rem;
		font-weight: 700;
	}
	.table {
		padding: 4px 0;
	}
	.tr {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
		align-items: baseline;
		padding: 10px 16px;
	}
	.tr.fl {
		grid-template-columns: 1fr 5.6rem 5.6rem;
	}
	.tr.landing {
		background: var(--surface-2);
	}
	.tr.total .what {
		font-weight: 700;
	}
	.pair {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-weight: 700;
	}
	.pair small {
		font-family: var(--font-sans, inherit);
		font-weight: 500;
		font-size: 0.72rem;
		color: var(--faint);
	}
	.tr.three {
		grid-template-columns: 1fr auto 2.6rem;
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
	.val {
		font-weight: 700;
	}
	.len {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.qty {
		text-align: right;
		font-weight: 700;
		font-size: 1.1rem;
	}
	.tip {
		margin: 10px 4px 0;
	}
	.code {
		margin: 0 4px;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.foot {
		margin: 14px 4px;
	}
</style>
