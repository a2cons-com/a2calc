<script lang="ts">
	import { formatNumber } from '$lib/calc/units';
	import { bags80, concreteOrder, pieceIn3, PIECE_DEFAULTS, PIECE_FIELDS, PIECE_NAMES, type Piece, type PieceKind } from '$lib/takeoff/concrete';
	import { concrete as st, newId } from '$lib/stores/app.svelte';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ProjectBar from '$lib/components/ProjectBar.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import ConcreteSketch from '$lib/components/ConcreteSketch.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ConcretePlan from '$lib/components/ConcretePlan.svelte';
	import Zoom from '$lib/components/Zoom.svelte';
	import Workbench from '$lib/components/Workbench.svelte';
	import { concreteScene, MAX_COPIES } from '$lib/takeoff/scene';

	let view = $state<'sketch' | 'plan' | '3d'>('sketch');
	const VIEWS: ['sketch' | 'plan' | '3d', string][] = [
		['sketch', 'Sketch'],
		['plan', 'Plan'],
		['3d', '3D']
	];

	const KINDS = Object.keys(PIECE_NAMES) as PieceKind[];
	const r = $derived(concreteOrder(st.pieces, st.wastePct, st.pumpYd3));
	const sel = $derived(Math.min(st.selected, st.pieces.length - 1));
	const piece = $derived(st.pieces[sel]);

	function add(kind: PieceKind = 'slab') {
		const [a, b, c] = PIECE_DEFAULTS[kind];
		st.pieces.push({ id: newId(), kind, a, b, c, count: 1 });
		st.selected = st.pieces.length - 1;
	}
	function setKind(p: Piece, kind: PieceKind) {
		if (p.kind === kind) return;
		const [a, b, c] = PIECE_DEFAULTS[kind];
		Object.assign(p, { kind, a, b, c });
	}
	function remove(i: number) {
		st.pieces.splice(i, 1);
		if (!st.pieces.length) add();
		st.selected = Math.max(0, Math.min(st.selected, st.pieces.length - 1));
	}
	/** Long sides default to feet when typed bare; thicknesses to inches. */
	const BARE: Record<PieceKind, ('ft' | 'in')[]> = {
		slab: ['ft', 'ft', 'in'],
		footing: ['ft', 'in', 'in'],
		wall: ['ft', 'ft', 'in'],
		beam: ['ft', 'in', 'in'],
		column: ['in', 'in', 'ft'],
		round: ['in', 'ft', 'in']
	};
	const bareFor = (kind: PieceKind, i: number) => BARE[kind][i];
	const yd = (v: number) => formatNumber(v, 2);
	const order = (v: number) => {
		const whole = Math.floor(v);
		const q = Math.round((v - whole) * 4);
		const fr = ['', '¼', '½', '¾'][q];
		return whole || !fr ? `${whole}${fr}` : fr;
	};
</script>

<svelte:head><title>Concrete · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Concrete" />
	<ProjectBar kind="concrete" />

	<Workbench id="concrete">
		{#snippet preview()}
			<div class="seg views">
				{#each VIEWS as [id, label] (id)}
					<button class:on={view === id} onclick={() => (view = id)}>{label}</button>
				{/each}
			</div>
			{#if piece}
				{#if view === 'sketch'}
					<ConcreteSketch {piece} />
				{:else if view === 'plan'}
					<Zoom><ConcretePlan {piece} /></Zoom>
				{:else}
					{#await import('$lib/components/Scene3D.svelte') then { default: Scene3D }}
						<Scene3D scene={concreteScene(st.pieces, sel)} onpick={(i) => (st.selected = i)} />
					{/await}
					<p class="fine hint">
						Every piece, side by side{st.pieces.some((p) => p.count > MAX_COPIES) ? ` (at most ${MAX_COPIES} of each)` : ''}; this one is tinted; tap a piece to pick it. Drag to turn, pinch to zoom.
					</p>
				{/if}
			{/if}
		{/snippet}

		<ResultCard label="Order" value={order(r.orderYd3)} unit="cu yd">
			<span>Neat volume</span><span>{formatNumber(r.netIn3 / 1728, 1)} cu ft · {yd(r.netYd3)} yd</span>
			<span>Waste {st.wastePct}%</span><span>{yd(r.wasteYd3)} yd</span>
			{#if r.pumpYd3 > 0}<span>Pump and line</span><span>{yd(r.pumpYd3)} yd</span>{/if}
			<span>Total</span><span>{yd(r.totalYd3)} yd</span>
			{#if r.netYd3 < 1 && r.netIn3 > 0}<span>Or premix (80 lb bags)</span><span>{bags80(r.netIn3 * (1 + st.wastePct / 100))} bags</span>{/if}
		</ResultCard>

		<div class="section-title">Pieces</div>
		<div class="tabs">
			{#each st.pieces as p, i (p.id)}
				<button class="pill" class:on={i === sel} onclick={() => (st.selected = i)}>
					{p.count > 1 ? `${p.count}× ` : ''}{PIECE_NAMES[p.kind]}
				</button>
			{/each}
			<button class="pill add" onclick={() => add(piece?.kind ?? 'slab')} aria-label="Add a piece"><Icon name="plus" size={16} /> Add</button>
		</div>

		{#if piece}
			<div class="card piece">
				<div class="kinds">
					{#each KINDS as k (k)}
						<button class="chip" class:on={piece.kind === k} onclick={() => setKind(piece, k)}>{PIECE_NAMES[k]}</button>
					{/each}
				</div>
				<div class="fields">
					<Field label={PIECE_FIELDS[piece.kind][0]} bind:value={piece.a} bare={bareFor(piece.kind, 0)} min={0} />
					<Field label={PIECE_FIELDS[piece.kind][1]} bind:value={piece.b} bare={bareFor(piece.kind, 1)} min={0} />
					{#if PIECE_FIELDS[piece.kind][2]}
						<Field label={PIECE_FIELDS[piece.kind][2] ?? ''} bind:value={piece.c} bare={bareFor(piece.kind, 2)} min={0} />
					{/if}
					<Field label="How many" kind="number" bind:value={piece.count} integer min={1} max={9999} />
				</div>
				<div class="piece-foot">
					<span class="fine num">This piece: {formatNumber(pieceIn3(piece) / 1728, 2)} cu ft · {yd(pieceIn3(piece) / 46656)} yd</span>
					<button class="btn quiet" onclick={() => remove(sel)}><Icon name="trash" size={18} /> Remove</button>
				</div>
			</div>
		{/if}

		<div class="section-title">Allowances</div>
		<div class="fields">
			<Field label="Waste" kind="number" bind:value={st.wastePct} suffix="%" min={0} max={50} note="Formed 3–5%, on ground 5–10%" />
			<Field label="Pump and line" kind="number" bind:value={st.pumpYd3} suffix="yd" min={0} max={5} note="Ask the pump company; ¼–½ yd typical" />
		</div>
		<p class="fine foot">Ordered to the next quarter yard. Volumes are neat dimensions: overdig, sloped subgrade and form bulge add to them.</p>
	</Workbench>
</div>

<style>
	.views {
		align-self: center;
		width: 14rem;
	}
	.views button {
		padding: 3px 0;
		font-size: 0.8rem;
	}
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 4px;
		scrollbar-width: none;
	}
	.pill.add {
		color: var(--primary-text);
		background: var(--primary-soft);
	}
	.piece {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		padding: 6px 11px;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--surface-2);
	}
	.chip.on {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.piece .fields :global(.field) {
		background: var(--field-inset);
	}
	.piece-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.hint {
		margin: -4px 0 0;
		text-align: center;
	}
	.foot {
		margin: 14px 4px;
	}
</style>
