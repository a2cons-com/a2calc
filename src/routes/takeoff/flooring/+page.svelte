<script lang="ts">
	import { formatFtIn, formatNumber } from '$lib/calc/units';
	import { floor as st, newId, prefs } from '$lib/stores/app.svelte';
	import { bestFit, cutAt, cutOffWall, defaultCuts, flooring, floorSection, floorSides, OFFSETS, PATTERNS, wallsBy, type FloorCut, type LineKind, type LineRef, type PatternId } from '$lib/takeoff/flooring';
	import { floorScene } from '$lib/takeoff/scene';
	import Field from '$lib/components/Field.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import ProjectBar from '$lib/components/ProjectBar.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import Workbench from '$lib/components/Workbench.svelte';
	import Zoom from '$lib/components/Zoom.svelte';
	import FloorLayout from '$lib/components/FloorLayout.svelte';
	import FloorSection from '$lib/components/FloorSection.svelte';

	const r = $derived(flooring(st));
	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const sqft = (in2: number) => formatNumber(in2 / 144, 1);
	const plank = $derived(st.material === 'plank');
	const pat = $derived(PATTERNS.find((p) => p.id === st.pattern)!);
	const PLANK_PATTERNS: PatternId[] = ['offset', 'grid', 'herringbone', 'basketweave'];
	const patterns = $derived(plank ? PATTERNS.filter((p) => PLANK_PATTERNS.includes(p.id)) : PATTERNS);
	const two = $derived(st.pattern === 'hopscotch' || st.pattern === 'octagon');

	/** The wall picked in the drawing or the list. */
	let wsel = $state(0);
	const wi = $derived(Math.min(wsel, r.walls.length - 1));
	const groups = $derived(wallsBy(r, Math.min(st.along, r.walls.length - 1)));
	const sides = $derived(floorSides(st));
	const allDoors = $derived(sides.flatMap((x, i) => x.doors.map((d, n) => ({ ...d, side: i, n }))));

	type Tab = 'room' | 'tile' | 'layout' | 'materials';
	const TABS: [Tab, string][] = [
		['room', 'Room'],
		['tile', 'Tile'],
		['layout', 'Layout'],
		['materials', 'Materials']
	];
	let tab = $state<Tab>('room');
	try {
		const v = localStorage.getItem('a2calc:tab:floor');
		if (TABS.some(([t]) => t === v)) tab = v as Tab;
	} catch {
		/* start on Room */
	}
	function show(t: Tab) {
		tab = t;
		try {
			localStorage.setItem('a2calc:tab:floor', t);
		} catch {
			/* not kept */
		}
	}
	function pickWall(i: number) {
		wsel = i;
		if (tab !== 'room' && tab !== 'layout') show('room');
	}

	// Views: the plan with its section marks, a section, 3D.
	type View = 'plan' | 'section' | '3d';
	const VIEWS: [View, string][] = [
		['plan', 'Plan'],
		['section', 'Section'],
		['3d', '3D']
	];
	let view = $state<View>('plan');
	try {
		const v = localStorage.getItem('a2calc:view:floor');
		if (VIEWS.some(([t]) => t === v)) view = v as View;
	} catch {
		/* start on the plan */
	}
	function see(v: View) {
		view = v;
		try {
			localStorage.setItem('a2calc:view:floor', v);
		} catch {
			/* not kept */
		}
	}
	const scene3 = $derived(view === '3d' ? floorScene(st, r) : null);

	// Sections
	let csel = $state(0);
	const ci = $derived(Math.max(0, Math.min(csel, st.cuts.length - 1)));
	const rowDeg = $derived.by(() => {
		const u = r.walls[Math.min(st.along, r.walls.length - 1)]?.d ?? [1, 0];
		return Math.round((Math.atan2(u[1], u[0]) * 180) / Math.PI);
	});
	const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
	/** A cut's angle to the rows, 0..180. */
	const rel = (c: FloorCut) => ((((c.deg - rowDeg) % 180) + 180) % 180);
	function moveCut(i: number, c: Pick<FloorCut, 'p' | 'deg'>) {
		st.cuts[i].p = c.p;
		st.cuts[i].deg = c.deg;
		csel = i;
	}
	function pickCut(i: number, open: boolean) {
		csel = i;
		if (open) see('section');
	}
	function turnCut(i: number, deg: number) {
		const c = st.cuts[i];
		const sec = floorSection(r, c);
		st.cuts[i] = { ...c, p: sec.ok ? sec.mid : c.p, deg: norm(deg) };
	}
	function addCut() {
		const [across, along] = defaultCuts(r, st.along, [newId(), newId()]);
		st.cuts.push(st.cuts.length % 2 ? along : across);
		csel = st.cuts.length - 1;
	}
	function removeCut(i: number) {
		st.cuts.splice(i, 1);
		csel = Math.max(0, i - 1);
	}
	function resetCuts() {
		st.cuts = defaultCuts(flooring(st), st.along, [newId(), newId()]);
		csel = 0;
	}

	// Room
	function setShape(rect: boolean) {
		if (rect === st.rect) return;
		if (!rect) st.sides = floorSides(st).map((x) => ({ ...x, doors: x.doors.map((d) => ({ ...d })) }));
		else {
			const a = st.sides[0]?.length ?? 144;
			const b = st.sides[1]?.length ?? 120;
			const keep = (i: number) => st.sides[i]?.doors ?? [];
			st.sides = [0, 1, 2, 3].map((i) => ({ id: newId(), length: i % 2 ? b : a, turn: 'right' as const, doors: keep(i) }));
		}
		st.rect = rect;
		wsel = 0;
		resetCuts();
	}
	function lShape() {
		const a = st.sides[0]?.length ?? 144;
		const b = st.sides[1]?.length ?? 120;
		const L = [a, b / 2, a / 2, b / 2, a / 2, b];
		const T: ('right' | 'left')[] = ['right', 'right', 'left', 'right', 'right', 'right'];
		st.sides = L.map((length, i) => ({ id: newId(), length: Math.round(length), turn: T[i], doors: [] }));
		st.rect = false;
		fixRefs();
		resetCuts();
	}
	function addWall() {
		st.sides.splice(wi + 1, 0, { id: newId(), length: 48, turn: 'right', doors: [] });
		wsel = wi + 1;
	}
	function removeWall(i: number) {
		if (st.sides.length <= 4) return;
		st.sides.splice(i, 1);
		wsel = Math.max(0, i - 1);
		fixRefs();
	}
	function fixRefs() {
		const n = (st.rect ? 4 : st.sides.length) - 1;
		st.along = Math.min(st.along, n);
		st.lineA.side = Math.min(st.lineA.side, n);
		st.lineB.side = Math.min(st.lineB.side, n);
	}
	function addDoor(i: number) {
		const w = sides[i];
		const width = Math.min(36, Math.max(12, w.length - 4));
		st.sides[i].doors.push({ id: newId(), at: Math.max(0, Math.round((w.length - width) / 2)), width });
	}

	// Tile
	function setPattern(p: PatternId) {
		st.pattern = p;
		if (p === 'herringbone' && st.tileL < 2 * st.tileW) st.tileL = 4 * st.tileW;
		if (p === 'basketweave') st.tileL = 3 * st.tileW + 2 * st.joint;
		if (p === 'hopscotch' && st.small >= st.tileW) st.small = Math.round(st.tileW / 2);
		if (p === 'octagon' && st.small >= st.tileW / 2) st.small = Math.round(st.tileW / 3);
	}
	function setMaterial(m: 'tile' | 'plank') {
		st.material = m;
		if (m === 'plank') {
			if (!PLANK_PATTERNS.includes(st.pattern)) st.pattern = 'offset';
			st.joint = 0;
			st.gap = 0.375;
			st.tileW = 7.25;
			st.tileL = 48;
			st.sheet = false;
			st.boxSqft = 24;
		} else {
			st.joint = 0.125;
			st.gap = 0.25;
			st.tileW = 12;
			st.tileL = 24;
			st.boxSqft = 15.5;
		}
	}

	// Layout
	const KINDS: [LineKind, string][] = [
		['center', 'Center'],
		['wall', 'Full at wall'],
		['offset', 'Off a wall'],
		['door', 'Doorway']
	];
	let fitMsg = $state('');
	function fit() {
		const b = bestFit(st);
		if (!b) {
			fitMsg = 'Too many pieces to try: lay a mosaic from the center.';
			return;
		}
		st.lineA = { ...st.lineA, kind: 'offset', side: groups.par.includes(st.lineA.side) ? st.lineA.side : groups.par[0], value: b.a };
		st.lineB = { ...st.lineB, kind: 'offset', side: groups.sq.includes(st.lineB.side) ? st.lineB.side : groups.sq[0], value: b.b };
		fitMsg = '';
	}
</script>

<svelte:head><title>Flooring · A2 Calc</title></svelte:head>

{#snippet lineEdit(ref: LineRef, name: string, what: string, walls: number[], doorWalls: number[])}
	{@const doors = allDoors.filter((d) => doorWalls.includes(d.side))}
	<div class="line card">
		<span class="lname"><b>{name}</b> {what}</span>
		<div class="seg kinds">
			{#each KINDS as [k, label] (k)}
				{#if k !== 'door' || doors.length}
					<button class:on={ref.kind === k} onclick={() => (ref.kind = k)}>{label}</button>
				{/if}
			{/each}
		</div>
		{#if ref.kind === 'wall' || ref.kind === 'offset'}
			<div class="pills">
				{#each walls as w (w)}
					<button class="pill" class:on={ref.side === w || (!walls.includes(ref.side) && w === walls[0])} onclick={() => (ref.side = w)}>Wall {w + 1}</button>
				{/each}
			</div>
		{/if}
		{#if ref.kind === 'offset'}
			<Field label="Off the wall" bind:value={ref.value} min={0} max={1200} note="Wall face to the line" />
		{:else if ref.kind === 'door'}
			<div class="pills">
				{#each doors as d (d.id)}
					<button class="pill" class:on={ref.door === d.id} onclick={() => (ref.door = d.id)}>Doorway {d.n + 1}, wall {d.side + 1}</button>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="page">
	<ToolHead title="Flooring" />
	<ProjectBar kind="flooring" />

	<Workbench id="flooring">
		{#snippet preview()}
			<div class="seg views">
				{#each VIEWS as [id, label] (id)}
					<button class:on={view === id} onclick={() => see(id)}>{label}</button>
				{/each}
			</div>
			{#if view === 'plan'}
				<Zoom><FloorLayout {r} input={st} selected={wi} onselect={pickWall} cuts={st.cuts} cutSel={ci} oncut={moveCut} oncutpick={pickCut} /></Zoom>
				<p class="fine hint">Tap a wall to edit it. A and B: the chalk lines. 1, 2…: sections; drag the line to slide one, its end to turn it, tap the end to see it. Red: slivers.</p>
			{:else if view === 'section'}
				{#if st.cuts.length}
					<div class="pager">
						<button onclick={() => (csel = ci - 1)} disabled={ci === 0} aria-label="Previous section">‹</button>
						<span class="mini">Section {ci + 1} of {st.cuts.length}</span>
						<button onclick={() => (csel = ci + 1)} disabled={ci === st.cuts.length - 1} aria-label="Next section">›</button>
					</div>
					<Zoom><FloorSection {r} input={st} cut={st.cuts[ci]} num={ci + 1} /></Zoom>
					<p class="fine hint">Cut {ci + 1} on the plan, looking the way its arrows point. Top: wall to wall, heights stretched; below: both ends at true size.</p>
				{:else}
					<p class="fine hint">No sections yet.</p>
					<div class="pills center"><button class="pill" onclick={addCut}>+ Section</button></div>
				{/if}
			{:else if scene3}
				{#await import('$lib/components/Scene3D.svelte') then { default: Scene3D }}
					<Scene3D scene={scene3} />
				{/await}
				<p class="fine hint">Walls cut low to see in. Drag to turn, pinch to zoom.</p>
			{/if}
		{/snippet}

		<ResultCard label="Floor" value={sqft(r.area)} unit="sq ft">
			{#each r.types as t (t.name)}
				<span>{t.name}{r.types.length > 1 ? ` ${ft(t.w)}` : ''}</span>
				<span>{st.sheet ? `${r.sheets} sheets` : `${t.order} pcs${t.boxes ? ` · ${t.boxes} boxes` : ''}`}</span>
			{/each}
			{#if !r.approx}<span>In the layout</span><span>{r.types.reduce((s, t) => s + t.full, 0)} full · {r.types.reduce((s, t) => s + t.cut, 0)} cut</span>{/if}
			{#if r.smallest !== null}<span>Smallest cut</span><span>{ft(r.smallest)}</span>{/if}
			{#if r.thinset}<span>Thinset</span><span>{r.thinset.bags} × 50 lb</span>{/if}
			{#if r.grout}<span>Grout</span><span>{formatNumber(r.grout.lbs, 1)} lb · {r.grout.bags} × 25 lb</span>{/if}
		</ResultCard>

		{#each r.warnings as w (w)}
			<p class="warn">{w}</p>
		{/each}

		<div class="seg tabs" role="tablist">
			{#each TABS as [t, label] (t)}
				<button role="tab" aria-selected={tab === t} class:on={tab === t} onclick={() => show(t)}>{label === 'Tile' && plank ? 'Plank' : label}</button>
			{/each}
		</div>

		{#if tab === 'room'}
			<div class="fields">
				<div class="seg">
					<button class:on={st.rect} onclick={() => setShape(true)}>Rectangle</button>
					<button class:on={!st.rect} onclick={() => setShape(false)}>Any shape</button>
				</div>
				{#if st.rect}
					<div class="two">
						<Field label="Length" bind:value={st.sides[0].length} bare="ft" min={12} max={2400} note="Walls 1 and 3" />
						<Field label="Width" bind:value={st.sides[1].length} bare="ft" min={12} max={2400} note="Walls 2 and 4" />
					</div>
				{:else}
					<p class="fine">Inside faces, around the room with the floor on your right; square corners.</p>
					{#each st.sides as w, i (w.id)}
						<div class="wallrow card" class:sel={wi === i}>
							<button class="wn" onclick={() => (wsel = i)}>{i + 1}</button>
							<Field label="Wall {i + 1}" bind:value={w.length} bare="ft" min={1} max={2400} />
							<div class="seg turn">
								<button class:on={w.turn === 'right'} onclick={() => (w.turn = 'right')} aria-label="Turn right">↱</button>
								<button class:on={w.turn === 'left'} onclick={() => (w.turn = 'left')} aria-label="Turn left">↰</button>
							</div>
							{#if st.sides.length > 4}<button class="icon-btn sm" aria-label="Remove wall {i + 1}" onclick={() => removeWall(i)}>×</button>{/if}
						</div>
					{/each}
					<div class="pills">
						<button class="pill" onclick={addWall}>+ Wall after {wi + 1}</button>
						<button class="pill" onclick={lShape}>L-shape</button>
					</div>
				{/if}

				<div class="section-title">Wall {wi + 1} · doorways</div>
				{#each st.sides[wi]?.doors ?? [] as d, n (d.id)}
					<div class="two door">
						<Field label="Doorway {n + 1} at" bind:value={d.at} min={0} max={sides[wi].length} note="From the wall's start" />
						<Field label="Width" bind:value={d.width} min={12} max={240} />
						<button class="pill rm" onclick={() => st.sides[wi].doors.splice(n, 1)}>Remove</button>
					</div>
				{/each}
				<div class="pills"><button class="pill" onclick={() => addDoor(wi)}>+ Doorway on wall {wi + 1}</button></div>

				<Field label="Gap at the walls" bind:value={st.gap} min={0} max={2} note={plank ? 'Expansion, under the base' : 'Movement joint, under the base'} />
			</div>
		{:else if tab === 'tile'}
			<div class="fields">
				<div class="seg">
					<button class:on={!plank} onclick={() => setMaterial('tile')}>Tile</button>
					<button class:on={plank} onclick={() => setMaterial('plank')}>Plank</button>
				</div>
				<div class="pills">
					{#each patterns as p (p.id)}
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
						<Field label="Width" bind:value={st.tileW} min={0.5} max={60} />
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
				{#if !plank}
					<Field label="Joint" bind:value={st.joint} min={0} max={1} note="Grout line" />
					<label class="check"><input type="checkbox" bind:checked={st.sheet} /> Mosaic on sheets</label>
					{#if st.sheet}<Field label="Sheet covers" kind="number" bind:value={st.sheetSqft} suffix="sq ft" min={0.1} max={20} />{/if}
				{/if}
				{#if !st.sheet}
					<div class="two">
						<Field label="{two ? r.types[0].name + ' box' : 'Box'} covers" kind="number" bind:value={st.boxSqft} suffix="sq ft" min={0} max={200} note="0: count pieces" />
						{#if two}<Field label="{r.types[1].name} box" kind="number" bind:value={st.box2Sqft} suffix="sq ft" min={0} max={200} />{/if}
					</div>
				{/if}
				<Field label="Extra" kind="number" bind:value={st.extraPct} suffix="%" min={0} max={50} note={plank && (st.pattern === 'offset' || st.pattern === 'grid') ? 'Over the area: offcuts start rows' : 'Over the layout\'s pieces: breakage, spares'} />
			</div>
		{:else if tab === 'layout'}
			<div class="fields">
				<div>
					<span class="mini">Rows run along</span>
					<div class="pills">
						{#each r.walls as _, i (i)}
							<button class="pill" class:on={st.along === i} onclick={() => (st.along = i)}>Wall {i + 1}</button>
						{/each}
					</div>
				</div>
				{@render lineEdit(st.lineA, 'A', `parallel to wall ${st.along + 1}`, groups.par, groups.sq)}
				{@render lineEdit(st.lineB, 'B', 'square to it', groups.sq, groups.par)}
				{#if st.lineA.kind !== 'wall' || st.lineB.kind !== 'wall'}
					<div>
						<span class="mini">On a center, offset or doorway line</span>
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
					{@const ow = cutOffWall(r, c)}
					{@const a = rel(c)}
					<div class="line card" class:sel={ci === i}>
						<span class="lname"><b>{i + 1}</b> {a === 90 ? 'across the rows' : a === 0 ? 'along the rows' : `${a}° to the rows`}{floorSection(r, c).ok ? '' : ' · misses the room'}</span>
						<div class="seg kinds">
							<button class:on={a === 90} onclick={() => turnCut(i, rowDeg + 90)}>Across</button>
							<button class:on={a === 0} onclick={() => turnCut(i, rowDeg)}>Along</button>
							<button class:on={a === 45} onclick={() => turnCut(i, rowDeg + 45)}>45°</button>
						</div>
						<div class="two">
							{#if ow}
								<Field label="Off wall {ow.side + 1}" value={ow.dist} min={0} max={2400} note="Wall face to the cut" onchange={(v) => (st.cuts[i].p = cutAt(r, c, ow.side, v))} />
							{/if}
							<Field label="Angle" kind="number" value={c.deg} suffix="°" min={-180} max={180} onchange={(v) => turnCut(i, v)} />
						</div>
						<div class="pills">
							<button class="pill" onclick={() => (st.cuts[i].flip = !c.flip)}>⇅ Look the other way</button>
							<button class="pill" onclick={() => pickCut(i, true)}>See it</button>
							<button class="pill rm" onclick={() => removeCut(i)}>Remove</button>
						</div>
					</div>
				{/each}
				<div class="pills">
					<button class="pill" onclick={addCut}>+ Section</button>
					<button class="pill" onclick={resetCuts}>Reset to the middle</button>
				</div>
			</div>

			<div class="section-title">Cuts at the walls</div>
			<div class="card table">
				{#each r.wallCuts as c, i (i)}
					<div class="tr">
						<span class="what">Wall {i + 1}<small>{ft(sides[i]?.length ?? 0)}</small></span>
						<span class="num val" class:bad={c !== null && c < Math.min(2, Math.min(st.tileW, st.tileL) / 3)}>{c === null ? 'full pieces' : `${ft(c)} smallest`}</span>
					</div>
				{/each}
			</div>
			<p class="fine foot">
				Snap A parallel to wall {st.along + 1}, {ft(r.lines[0].dist)} off wall {r.lines[0].side + 1}; snap B square to it, {ft(r.lines[1].dist)} off wall {r.lines[1].side + 1}. Square them with a 3-4-5 (or 6-8-10) triangle before you set the first piece.
			</p>
		{:else}
			<div class="card table">
				{#each r.types as t (t.name)}
					<div class="tr three">
						<span class="what">{t.name}<small>{st.pattern === 'hex' ? `${ft(t.w)} across the flats` : `${ft(t.w)} × ${ft(t.l)}`}{r.approx ? '' : ` · ${t.full} full, ${t.cut} cut`}</small></span>
						<span class="num len">{t.need} + {st.extraPct}%</span>
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
				{#if r.rolls}
					<div class="tr three"><span class="what">Underlayment<small>{formatNumber(st.rollSqft, 0)} sq ft each</small></span><span class="num len"></span><span class="num qty">{r.rolls}</span></div>
				{/if}
				{#if st.base}
					<div class="tr three"><span class="what">Base<small>Less doorways · 8′ pieces +10%</small></span><span class="num len">{formatNumber(r.baseLf, 1)} lf</span><span class="num qty">{Math.ceil((r.baseLf * 1.1) / 8 - 1e-9)}</span></div>
				{/if}
				{#if r.doors}
					<div class="tr three"><span class="what">Transitions<small>One per doorway</small></span><span class="num len"></span><span class="num qty">{r.doors}</span></div>
				{/if}
			</div>
			<div class="fields gap">
				{#if !plank}<Field label="Tile thickness" bind:value={st.thick} min={0.125} max={2} note="Grout depth" />{/if}
				<Field label="Underlayment covers" kind="number" bind:value={st.rollSqft} suffix="sq ft" min={0} max={1000} note="Roll or sheet; 0 for none" />
				<label class="check"><input type="checkbox" bind:checked={st.base} /> Base trim</label>
			</div>
			<p class="fine foot">
				Pieces are counted from the layout: every cut piece takes a whole one{plank && (st.pattern === 'offset' || st.pattern === 'grid') ? ', except planks in rows, counted by area since each row starts with the last one\'s offcut' : ''}. Thinset at the trowel's typical coverage, grout from the joints' volume plus 10%. Check the coverage on the bags and boxes you buy.
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
	.views {
		align-self: center;
		width: 15rem;
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
	.line.sel {
		border-color: var(--primary);
	}
	.pills.center {
		justify-content: center;
	}
	.tabs button {
		font-size: 0.8rem;
		padding-left: 0;
		padding-right: 0;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.two.door {
		grid-template-columns: 1fr 1fr auto;
		align-items: center;
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
	.wallrow {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 8px;
		align-items: center;
		padding: 6px 8px;
	}
	.wallrow.sel {
		outline: 2px solid var(--primary);
	}
	.wn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--surface-2, var(--bg));
		font-weight: 700;
		color: var(--muted);
	}
	.wallrow.sel .wn {
		background: var(--primary);
		color: var(--primary-ink);
	}
	.turn {
		width: 5.5rem;
	}
	.line {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
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
