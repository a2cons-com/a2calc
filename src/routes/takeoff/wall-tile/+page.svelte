<script lang="ts">
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { newId, prefs, walltile as st } from '$lib/stores/app.svelte';
	import { bestFit, OFFSETS, PATTERNS, wallsBy, type LineKind, type LineRef, type PatternId } from '$lib/takeoff/flooring';
	import { SIDE_NAME, wallFloorInput, wallTile, type OpeningKind } from '$lib/takeoff/walltile';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ProjectBar from '$lib/components/ProjectBar.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import Workbench from '$lib/components/Workbench.svelte';
	import Zoom from '$lib/components/Zoom.svelte';
	import WallTileElevation from '$lib/components/WallTileElevation.svelte';
	import WallTileSection from '$lib/components/WallTileSection.svelte';

	const w = $derived(wallTile(st));
	const r = $derived(w.f);
	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const sqft = (in2: number) => formatNumber(in2 / 144, 1);
	const pat = $derived(PATTERNS.find((p) => p.id === st.pattern)!);
	const two = $derived(st.pattern === 'hopscotch' || st.pattern === 'octagon');
	const groups = $derived(wallsBy(r, 2));
	const below = $derived(st.top < st.ceiling - 0.5);

	type Tab = 'wall' | 'tile' | 'layout' | 'materials';
	const TABS: [Tab, string][] = [
		['wall', 'Wall'],
		['tile', 'Tile'],
		['layout', 'Layout'],
		['materials', 'Materials']
	];
	let tab = $state<Tab>('wall');
	type View = 'elevation' | 'section';
	let view = $state<View>('elevation');
	try {
		const t = localStorage.getItem('a2calc:tab:walltile');
		if (TABS.some(([k]) => k === t)) tab = t as Tab;
		const v = localStorage.getItem('a2calc:view:walltile');
		if (v === 'elevation' || v === 'section') view = v;
	} catch {
		/* defaults */
	}
	const keep = (k: string, v: string) => {
		try {
			localStorage.setItem(k, v);
		} catch {
			/* not kept */
		}
	};
	function show(t: Tab) {
		tab = t;
		keep('a2calc:tab:walltile', t);
	}
	function see(v: View) {
		view = v;
		keep('a2calc:view:walltile', v);
	}

	// Openings
	let osel = $state(0);
	const oi = $derived(Math.max(0, Math.min(osel, st.openings.length - 1)));
	const NAME: Record<OpeningKind, string> = { window: 'Window', niche: 'Niche', door: 'Door' };
	function addOpening(kind: OpeningKind) {
		const wd = kind === 'door' ? 30 : kind === 'niche' ? 12 : 30;
		const h = kind === 'door' ? 80 : kind === 'niche' ? 24 : 36;
		const sill = kind === 'door' ? 0 : kind === 'niche' ? Math.max(w.y0 + 30, 40) : 40;
		st.openings.push({ id: newId(), kind, x: Math.max(0, Math.round((st.length - wd) / 2)), sill, w: wd, h, depth: kind === 'niche' ? 3.5 : 0 });
		osel = st.openings.length - 1;
	}
	function pickOpening(i: number) {
		osel = i;
		show('wall');
	}
	function setKind(i: number, kind: OpeningKind) {
		const o = st.openings[i];
		o.kind = kind;
		if (kind === 'door') o.sill = 0;
		if (kind === 'niche' && !o.depth) o.depth = 3.5;
	}

	// Sections
	let csel = $state(0);
	const ci = $derived(Math.max(0, Math.min(csel, st.cuts.length - 1)));
	function moveCut(i: number, x: number) {
		st.cuts[i].x = x;
		csel = i;
	}
	function pickCut(i: number, open: boolean) {
		csel = i;
		if (open) see('section');
	}
	function addCut() {
		st.cuts.push({ id: newId(), x: Math.round(st.length * (st.cuts.length % 2 ? 0.7 : 0.3)) });
		csel = st.cuts.length - 1;
	}

	// Tile
	function setPattern(p: PatternId) {
		st.pattern = p;
		if (p === 'herringbone' && st.tileL < 2 * st.tileW) st.tileL = 4 * st.tileW;
		if (p === 'basketweave') st.tileL = 3 * st.tileW + 2 * st.joint;
		if (p === 'hopscotch' && st.small >= st.tileW) st.small = Math.round(st.tileW / 2);
		if (p === 'octagon' && st.small >= st.tileW / 2) st.small = Math.round(st.tileW / 3);
	}

	// Layout
	const KINDS: [LineKind, string][] = [
		['center', 'Center'],
		['wall', 'Full at'],
		['offset', 'Off'],
		['door', 'Opening']
	];
	let fitMsg = $state('');
	function fit() {
		const b = bestFit(wallFloorInput(st));
		if (!b) {
			fitMsg = 'Too many pieces to try: lay a mosaic from the center.';
			return;
		}
		st.lineA = { ...st.lineA, kind: 'offset', side: groups.par.includes(st.lineA.side) ? st.lineA.side : groups.par[0], value: b.a };
		st.lineB = { ...st.lineB, kind: 'offset', side: groups.sq.includes(st.lineB.side) ? st.lineB.side : groups.sq[0], value: b.b };
		fitMsg = '';
	}
	const sideName = (i: number) => SIDE_NAME[i].toLowerCase();
</script>

<svelte:head><title>Wall tile · A2 Calc</title></svelte:head>

{#snippet lineEdit(ref: LineRef, name: string, what: string, sides: number[])}
	<div class="line card">
		<span class="lname"><b>{name}</b> {what}</span>
		<div class="seg kinds">
			{#each KINDS as [k, label] (k)}
				{#if k !== 'door' || st.openings.length}
					<button class:on={ref.kind === k} onclick={() => (ref.kind = k)}>{label}</button>
				{/if}
			{/each}
		</div>
		{#if ref.kind === 'wall' || ref.kind === 'offset'}
			<div class="pills">
				{#each sides as sd (sd)}
					<button class="pill" class:on={ref.side === sd || (!sides.includes(ref.side) && sd === sides[0])} onclick={() => (ref.side = sd)}>{SIDE_NAME[sd]}</button>
				{/each}
			</div>
		{/if}
		{#if ref.kind === 'offset'}
			<Field label="Off the {sideName(sides.includes(ref.side) ? ref.side : sides[0])}" bind:value={ref.value} min={0} max={1200} />
		{:else if ref.kind === 'door'}
			<div class="pills">
				{#each st.openings as o, n (o.id)}
					<button class="pill" class:on={ref.door === o.id} onclick={() => (ref.door = o.id)}>{NAME[o.kind]} {n + 1}'s middle</button>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="page">
	<ToolHead title="Wall tile" />
	<ProjectBar kind="walltile" />

	<Workbench id="walltile">
		{#snippet preview()}
			<div class="seg views">
				<button class:on={view === 'elevation'} onclick={() => see('elevation')}>Elevation</button>
				<button class:on={view === 'section'} onclick={() => see('section')}>Section</button>
			</div>
			{#if view === 'elevation'}
				<Zoom><WallTileElevation {w} input={st} selected={oi} onselect={pickOpening} cutSel={ci} oncut={moveCut} oncutpick={pickCut} /></Zoom>
				<p class="fine hint">As seen from the room. Tap an opening to edit it. A: level line, B: plumb line. 1, 2…: sections; drag one along the wall, tap its tag to see it. Red: slivers.</p>
			{:else if st.cuts.length}
				<div class="pager">
					<button onclick={() => (csel = ci - 1)} disabled={ci === 0} aria-label="Previous section">‹</button>
					<span class="mini">Section {ci + 1} of {st.cuts.length} · {ft(st.cuts[ci].x)} from the left end</span>
					<button onclick={() => (csel = ci + 1)} disabled={ci === st.cuts.length - 1} aria-label="Next section">›</button>
				</div>
				<Zoom><WallTileSection {w} input={st} x={st.cuts[ci].x} num={ci + 1} /></Zoom>
				<p class="fine hint">Cut plumb through the wall, the room on the right. Left: the whole height; right: the top and bottom of the tile at true size.</p>
			{:else}
				<p class="fine hint">No sections yet.</p>
				<div class="pills center"><button class="pill" onclick={addCut}>+ Section</button></div>
			{/if}
		{/snippet}

		<ResultCard label="Wall tile" value={sqft(r.layArea + w.extraArea)} unit="sq ft">
			{#each r.types as t (t.name)}
				<span>{t.name}{r.types.length > 1 ? ` ${ft(t.w)}` : ''}</span>
				<span>{st.sheet ? `${r.sheets} sheets` : `${t.order} pcs${t.boxes ? ` · ${t.boxes} boxes` : ''}`}</span>
			{/each}
			{#if !r.approx}<span>In the layout</span><span>{r.types.reduce((s, t) => s + t.full, 0)} full · {r.types.reduce((s, t) => s + t.cut, 0)} cut</span>{/if}
			{#if r.smallest !== null}<span>Smallest cut</span><span>{ft(r.smallest)}</span>{/if}
			{#if w.trimPcs}<span>Edge trim</span><span>{formatNumber(w.trimLf, 1)} lf · {w.trimPcs} pcs</span>{/if}
			{#if r.grout}<span>Grout</span><span>{formatNumber(r.grout.lbs, 1)} lb</span>{/if}
		</ResultCard>

		{#each w.warnings as m (m)}
			<p class="warn">{m}</p>
		{/each}

		<div class="seg tabs" role="tablist">
			{#each TABS as [t, label] (t)}
				<button role="tab" aria-selected={tab === t} class:on={tab === t} onclick={() => show(t)}>{label}</button>
			{/each}
		</div>

		{#if tab === 'wall'}
			<div class="fields">
				<div class="two">
					<Field label="Wall length" bind:value={st.length} bare="ft" min={6} max={1200} note="End to end" />
					<Field label="Ceiling" bind:value={st.ceiling} bare="ft" min={24} max={400} note="Floor to ceiling" />
				</div>
				<div>
					<span class="mini">The tile starts</span>
					<div class="seg">
						<button class:on={st.start === 'floor'} onclick={() => (st.start = 'floor')}>At the floor</button>
						<button class:on={st.start === 'tub'} onclick={() => (st.start = 'tub')}>On a tub or base</button>
					</div>
				</div>
				{#if st.start === 'tub'}
					<Field label="Tub or base, top" bind:value={st.tubHeight} min={1} max={60} note="Tub about 15″, shower curb or pan 2–6″" />
				{/if}
				<Field label="Tile up to" bind:value={st.top} bare="ft" min={4} max={st.ceiling} note="Above the floor" />
				<div class="pills">
					<button class="pill" class:on={st.top === 48} onclick={() => (st.top = 48)}>4′ wainscot</button>
					<button class="pill" class:on={st.top === 84} onclick={() => (st.top = 84)}>7′ shower</button>
					<button class="pill" class:on={st.top === st.ceiling} onclick={() => (st.top = st.ceiling)}>To the ceiling</button>
				</div>
				{#if below}<label class="check"><input type="checkbox" bind:checked={st.trimTop} /> Edge trim along the top</label>{/if}
				<div class="two">
					{#each [['left', 'Left end'], ['right', 'Right end']] as [k, label] (k)}
						{@const key = k as 'left' | 'right'}
						<div>
							<span class="mini">{label}</span>
							<div class="seg ends">
								<button class:on={st[key] === 'corner'} onclick={() => (st[key] = 'corner')}>Corner</button>
								<button class:on={st[key] === 'edge'} onclick={() => (st[key] = 'edge')}>Open, trimmed</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="section-title">Openings</div>
				{#each st.openings as o, i (o.id)}
					<div class="line card" class:sel={oi === i}>
						<span class="lname"><b>{i + 1}</b> {NAME[o.kind]}</span>
						<div class="seg kinds">
							{#each ['window', 'niche', 'door'] as k (k)}
								<button class:on={o.kind === k} onclick={() => setKind(i, k as OpeningKind)}>{NAME[k as OpeningKind]}</button>
							{/each}
						</div>
						<div class="two">
							<Field label="From the left" bind:value={o.x} min={0} max={st.length} note="Wall end to its side" />
							{#if o.kind !== 'door'}<Field label="Bottom at" bind:value={o.sill} min={0} max={st.ceiling} note="Above the floor" />{/if}
							<Field label="Width" bind:value={o.w} min={1} max={st.length} />
							<Field label="Height" bind:value={o.h} min={1} max={st.ceiling} />
							{#if o.kind === 'niche'}
								<Field label="Depth" bind:value={o.depth} min={0.5} max={12} note="Back and sides tiled" />
							{:else if o.kind === 'window'}
								<Field label="Returns" bind:value={o.depth} min={0} max={12} note="Tiled depth; 0 for none" />
							{/if}
						</div>
						<div class="pills"><button class="pill rm" onclick={() => st.openings.splice(i, 1)}>Remove</button></div>
					</div>
				{/each}
				<div class="pills">
					<button class="pill" onclick={() => addOpening('window')}>+ Window</button>
					<button class="pill" onclick={() => addOpening('niche')}>+ Niche</button>
					<button class="pill" onclick={() => addOpening('door')}>+ Door</button>
				</div>
				<Field label="Gap at the edges" bind:value={st.gap} min={0} max={1} note="At the tub, the corners and openings: caulked" />
			</div>
		{:else if tab === 'tile'}
			<div class="fields">
				<div class="pills">
					{#each PATTERNS as p (p.id)}
						<button class="pill" class:on={st.pattern === p.id} onclick={() => setPattern(p.id)}>{p.name}</button>
					{/each}
				</div>
				{#if st.pattern === 'hopscotch'}
					<div class="two">
						<Field label="Large square" bind:value={st.tileW} min={1} max={60} />
						<Field label="Small square" bind:value={st.small} min={0.5} max={st.tileW - 0.25} />
					</div>
				{:else if st.pattern === 'hex'}
					<Field label="Across the flats" bind:value={st.tileW} min={0.5} max={60} note="Point to point {ft((st.tileW * 2) / Math.sqrt(3))}" />
				{:else if st.pattern === 'octagon'}
					<div class="two">
						<Field label="Octagon" bind:value={st.tileW} min={2} max={60} note="Across the flats" />
						<Field label="Dot" bind:value={st.small} min={0.5} max={st.tileW / 2} note="Square's side" />
					</div>
				{:else}
					<div class="two">
						<Field label="Height" bind:value={st.tileW} min={0.5} max={60} note="Up the wall" />
						<Field label="Length" bind:value={st.tileL} min={0.5} max={120} note="Along the rows" />
					</div>
				{/if}
				{#if st.pattern === 'offset'}
					<div>
						<span class="mini">Each row steps</span>
						<div class="seg">
							{#each OFFSETS as [f, label] (f)}
								<button class:on={Math.abs(st.offset - f) < 1e-6} onclick={() => (st.offset = f)}>{label} length</button>
							{/each}
						</div>
					</div>
				{/if}
				<label class="check"><input type="checkbox" bind:checked={st.turned} /> {pat.turn}</label>
				<Field label="Joint" bind:value={st.joint} min={0} max={1} note="Grout line" />
				<label class="check"><input type="checkbox" bind:checked={st.sheet} /> Mosaic on sheets</label>
				{#if st.sheet}<Field label="Sheet covers" kind="number" bind:value={st.sheetSqft} suffix="sq ft" min={0.1} max={20} />{/if}
				{#if !st.sheet}
					<div class="two">
						<Field label="{two ? r.types[0].name + ' box' : 'Box'} covers" kind="number" bind:value={st.boxSqft} suffix="sq ft" min={0} max={200} note="0: count pieces" />
						{#if two}<Field label="{r.types[1].name} box" kind="number" bind:value={st.box2Sqft} suffix="sq ft" min={0} max={200} />{/if}
					</div>
				{/if}
				<Field label="Extra" kind="number" bind:value={st.extraPct} suffix="%" min={0} max={50} note="Over the layout's pieces: breakage, spares" />
			</div>
		{:else if tab === 'layout'}
			<div class="fields">
				{@render lineEdit(st.lineA, 'A', 'level, along the wall', groups.par)}
				{@render lineEdit(st.lineB, 'B', 'plumb', groups.sq)}
				{#if st.lineA.kind !== 'wall' || st.lineB.kind !== 'wall'}
					<div>
						<span class="mini">On a center, offset or opening line</span>
						<div class="seg">
							<button class:on={st.onLine === 'joint'} onclick={() => (st.onLine = 'joint')}>A joint</button>
							<button class:on={st.onLine === 'center'} onclick={() => (st.onLine = 'center')}>A piece's middle</button>
						</div>
					</div>
				{/if}
				<button class="btn" onclick={fit}>Best fit: widest smallest cut</button>
				{#if fitMsg}<p class="fine">{fitMsg}</p>{/if}
			</div>

			<div class="section-title">Sections</div>
			<div class="fields">
				{#each st.cuts as c, i (c.id)}
					<div class="cutrow" class:sel={ci === i}>
						<button class="wn" onclick={() => pickCut(i, true)} aria-label="See section {i + 1}">{i + 1}</button>
						<Field label="Section {i + 1} from the left" bind:value={c.x} min={0.5} max={st.length - 0.5} />
						<button class="icon-btn sm" aria-label="Remove section {i + 1}" onclick={() => st.cuts.splice(i, 1)}>×</button>
					</div>
				{/each}
				<div class="pills"><button class="pill" onclick={addCut}>+ Section</button></div>
			</div>

			<div class="section-title">Cuts at the edges</div>
			<div class="card table">
				{#each r.wallCuts as c, i (i)}
					<div class="tr">
						<span class="what">{SIDE_NAME[i]}<small>{ft(i % 2 ? w.y1 - w.y0 : st.length)}</small></span>
						<span class="num val" class:bad={c !== null && c < Math.min(2, Math.min(st.tileW, st.tileL) / 3)}>{c === null ? 'full pieces' : `${ft(c)} smallest`}</span>
					</div>
				{/each}
			</div>
			<p class="fine foot">
				Mark A level, {ft(r.lines[0].dist)} off the {sideName(r.lines[0].side)}{st.start === 'tub' && r.lines[0].side === 2 ? ' (the tub)' : ''}, and B plumb, {ft(r.lines[1].dist)} off the {sideName(r.lines[1].side)}. Screw a ledger along A and set the rows above it first; the bottom row goes in last, cut to fit.
			</p>
		{:else}
			<div class="card table">
				{#each r.types as t, ti (t.name)}
					<div class="tr three">
						<span class="what">{t.name}<small>{st.pattern === 'hex' ? `${ft(t.w)} across the flats` : `${ft(t.w)} × ${ft(t.l)}`}{r.approx ? '' : ` · ${t.full} full, ${t.cut} cut`}{ti === 0 && w.extraPcs ? ` · ${w.extraPcs} for niches and returns` : ''}</small></span>
						<span class="num len">+{st.extraPct}%</span>
						<span class="num qty">{t.order}</span>
					</div>
					{#if t.boxes && !st.sheet}
						<div class="tr three"><span class="what">Boxes<small>{formatNumber(t.boxSqft, 2)} sq ft each</small></span><span class="num len"></span><span class="num qty">{t.boxes}</span></div>
					{/if}
				{/each}
				{#if st.sheet}
					<div class="tr three"><span class="what">Sheets<small>{formatNumber(st.sheetSqft, 2)} sq ft each</small></span><span class="num len">+{st.extraPct}%</span><span class="num qty">{r.sheets}</span></div>
				{/if}
				{#if r.thinset}
					<div class="tr three"><span class="what">Thinset, 50 lb<small>{r.thinset.trowel} trowel</small></span><span class="num len"></span><span class="num qty">{r.thinset.bags}</span></div>
				{/if}
				{#if r.grout}
					<div class="tr three"><span class="what">Grout, 25 lb<small>{r.grout.sanded ? 'Sanded' : 'Unsanded'} · {formatNumber(r.grout.lbs, 1)} lb</small></span><span class="num len"></span><span class="num qty">{r.grout.bags}</span></div>
				{/if}
				{#if w.backer}
					<div class="tr three"><span class="what">Backer board<small>{formatNumber(st.backerSqft, 0)} sq ft sheets +10%</small></span><span class="num len"></span><span class="num qty">{w.backer}</span></div>
				{/if}
				{#if w.trimPcs}
					<div class="tr three"><span class="what">Edge trim<small>Top, open ends, windows and niches · {ft(st.trimLen)} pieces +10%</small></span><span class="num len">{formatNumber(w.trimLf, 1)} lf</span><span class="num qty">{w.trimPcs}</span></div>
				{/if}
			</div>
			<div class="fields gap">
				<Field label="Tile thickness" bind:value={st.thick} min={0.125} max={1} note="Grout depth" />
				<Field label="Backer board sheet" kind="number" bind:value={st.backerSqft} suffix="sq ft" min={0} max={50} note="3×5 is 15; 0 for none" />
				<Field label="Trim piece" bind:value={st.trimLen} min={12} max={144} note="Bullnose or metal edge" />
			</div>
			<p class="fine foot">
				Pieces are counted from the layout: every cut piece takes a whole one. Niche backs and sides and tiled window returns are added by area. Thinset at the trowel's typical coverage, grout from the joints' volume plus 10%.
			</p>
		{/if}
	</Workbench>
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
	.tabs {
		margin: 14px 0 10px;
	}
	.tabs button {
		font-size: 0.8rem;
		padding-left: 0;
		padding-right: 0;
	}
	.views {
		align-self: center;
		width: 12rem;
	}
	.views button {
		padding: 3px 0;
		font-size: 0.8rem;
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
	.pager button {
		min-width: 34px;
		font-size: 1.3rem;
		line-height: 1;
		padding: 0 6px 2px;
		border-radius: 8px;
		color: var(--primary-text);
	}
	.pager button:disabled {
		color: var(--faint);
		cursor: default;
	}
	.pills.center {
		justify-content: center;
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
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pill {
		font-size: 0.8rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		padding: 4px 2px;
	}
	.ends button {
		font-size: 0.74rem;
		padding-left: 0;
		padding-right: 0;
	}
	.line {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
	}
	.line.sel {
		outline: 2px solid var(--primary);
	}
	.lname {
		font-size: 0.9rem;
		color: var(--muted);
	}
	.lname b {
		color: var(--primary-text);
		margin-right: 4px;
	}
	.kinds button {
		font-size: 0.74rem;
		padding-left: 0;
		padding-right: 0;
	}
	.cutrow {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 8px;
		align-items: center;
	}
	.wn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--surface-2, var(--bg));
		font-weight: 700;
		color: var(--muted);
	}
	.cutrow.sel .wn {
		background: var(--primary);
		color: var(--primary-ink);
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
	.tr.three {
		grid-template-columns: 1fr auto 3.2rem;
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
	.len,
	.val {
		color: var(--muted);
	}
	.val.bad {
		color: var(--danger);
		font-weight: 600;
	}
	.qty {
		text-align: right;
		font-weight: 700;
		font-size: 1.1rem;
	}
	.foot {
		margin: 14px 4px;
	}
</style>
