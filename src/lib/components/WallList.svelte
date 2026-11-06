<script lang="ts">
	// The walls of a wall takeoff (studs or block), one at a time: chips to
	// pick a wall (the plan picks too), its elevation, length, turn, doors
	// and windows; then "add a wall" and whether the walls close.
	import type { Snippet } from 'svelte';
	import { freeSpot, place, type Opening, type Run } from '$lib/takeoff/framing';
	import { newId } from '$lib/stores/app.svelte';
	import Field from './Field.svelte';
	import Icon from './Icon.svelte';

	let {
		walls,
		height,
		selected,
		onselect,
		header = '',
		openingLabel = 'RO',
		elevation,
		openingExtra
	}: {
		/** The takeoff's state: its runs and whether they close (edited in place). */
		walls: { runs: Run[]; closed: boolean };
		height: number;
		selected: number;
		onselect: (id: number | null) => void;
		/** Header size for a new opening (studs). */
		header?: string;
		/** "RO" (rough opening) or "Opening" in the width/height labels. */
		openingLabel?: string;
		elevation: Snippet<[Run, (id: number, offset: number) => void]>;
		openingExtra?: Snippet<[Opening]>;
	} = $props();

	const run = $derived(walls.runs.find((x) => x.id === selected) ?? walls.runs[0]);
	const i = $derived(walls.runs.indexOf(run));

	function addRun() {
		const id = newId();
		walls.runs.push({ id, length: 120, openings: [], turn: 'right' });
		onselect(id);
	}
	function removeRun(k: number) {
		walls.runs.splice(k, 1);
		onselect(walls.runs[Math.max(0, k - 1)]?.id ?? null);
	}
	/** A new door or window goes in the largest free stretch of wall, a
	 *  foot from the others; the wall grows when there is no room. */
	function addOpening(r: Run, kind: Opening['kind']) {
		const width = kind === 'door' ? 38 : 36;
		// Pin centered openings where they are, so a longer wall can't shift them.
		for (const p of place(r, height)) if (p.o.offset === null) p.o.offset = Math.round(p.a);
		const spot = freeSpot(r, width, height);
		if (spot.length > r.length) r.length = spot.length;
		r.openings.push(
			kind === 'door'
				? { id: newId(), kind, width, height: 82.5, sill: 0, offset: spot.offset, header }
				: { id: newId(), kind, width, height: 48, sill: 36, offset: spot.offset, header }
		);
	}
	function moveOpening(r: Run, id: number, offset: number) {
		const o = r.openings.find((x) => x.id === id);
		if (o) o.offset = offset;
	}
</script>

{#if run}
	<div class="section-title run-title">
		<div class="chips">
			{#each walls.runs as x, k (x.id)}
				<button class="pill" class:on={x.id === run.id} onclick={() => onselect(x.id)}>Wall {k + 1}</button>
			{/each}
		</div>
		{#if walls.runs.length > 1}
			<button class="btn quiet small" onclick={() => removeRun(i)}><Icon name="trash" size={16} /> Remove</button>
		{/if}
	</div>
	<div class="card run">
		{@render elevation(run, (id, a) => moveOpening(run, id, a))}
		{#if run.openings.length}<p class="fine hint">Drag a door or window along the wall to move it.</p>{/if}
		<Field label="Length" bind:value={run.length} bare="ft" min={12} max={2400} />
		{#if i > 0 || (walls.closed && walls.runs.length > 2)}
			<div class="turn">
				<span class="mini">Turn from wall {i > 0 ? i : walls.runs.length}</span>
				<div class="seg">
					<button class:on={(run.turn ?? 'right') === 'left'} onclick={() => (run.turn = 'left')}>↰ Left</button>
					<button class:on={(run.turn ?? 'right') === 'right'} onclick={() => (run.turn = 'right')}>Right ↱</button>
				</div>
			</div>
		{/if}
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
					<Field label="{openingLabel} width" bind:value={o.width} bare="in" min={6} max={run.length} />
					<Field label="{openingLabel} height" bind:value={o.height} bare="in" min={6} max={height} />
					{#if o.kind === 'window'}
						<Field label="Sill height" bind:value={o.sill} bare="in" min={0} max={height} />
					{/if}
					<Field label="From left" value={o.offset ?? (run.length - o.width) / 2} onchange={(v) => (o.offset = v)} bare="in" min={0} max={run.length} note={o.offset === null ? 'centered' : ''} />
				</div>
				{@render openingExtra?.(o)}
			</div>
		{/each}
		<div class="add-row">
			<button class="btn" onclick={() => addOpening(run, 'door')}><Icon name="plus" size={16} /> Door</button>
			<button class="btn" onclick={() => addOpening(run, 'window')}><Icon name="plus" size={16} /> Window</button>
		</div>
	</div>
{/if}

<div class="add-run">
	<button class="btn solid" onclick={addRun}><Icon name="plus" size={18} /> Turn a corner, add a wall</button>
	{#if walls.runs.length > 2}
		<label class="toggle"><input type="checkbox" bind:checked={walls.closed} /> Last wall closes back to the first</label>
	{/if}
</div>

<style>
	.run-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.chips {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		min-width: 0;
		padding: 2px 0;
	}
	.chips .pill {
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: 0;
		white-space: nowrap;
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
	.hint {
		margin: -4px 0 0;
		text-align: center;
	}
	.run :global(.field) {
		background: var(--bg);
	}
	.mini {
		display: block;
		font-size: 0.78rem;
		color: var(--muted);
		margin: 2px 2px 4px;
	}
	.turn {
		display: flex;
		flex-direction: column;
	}
	.seg button {
		font-size: 0.85rem;
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
</style>
