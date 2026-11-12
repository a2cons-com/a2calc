<script lang="ts">
	// One wall as seen from the room, floor to ceiling: the tub or base it
	// starts on, every piece as laid (cut ones lighter, slivers red), its
	// windows, niches and doors, the trim, the level and plumb lines, and
	// the section cuts (drag one along the wall; tap its tag to see it).
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import type { V2 } from '$lib/takeoff/flooring';
	import type { WallTileInput, WallTileResult } from '$lib/takeoff/walltile';

	let {
		w,
		input,
		selected = -1,
		onselect,
		cutSel = -1,
		oncut,
		oncutpick
	}: {
		w: WallTileResult;
		input: WallTileInput;
		/** The opening picked (by index). */
		selected?: number;
		onselect?: (i: number) => void;
		cutSel?: number;
		/** A section cut dragged along the wall: its new distance from the left end. */
		oncut?: (i: number, x: number) => void;
		oncutpick?: (i: number, open: boolean) => void;
	} = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);
	const r = $derived(w.f);

	const L = $derived(Math.max(1, input.length));
	/** Plan y of a height above the floor. */
	const Y = (h: number) => input.top - h;
	const yTop = $derived(Y(Math.max(input.ceiling, input.top)));
	const yFloor = $derived(Y(0));
	const big = $derived(Math.max(L, yFloor - yTop, 24));
	const fs = $derived(Math.max(2.5, big * 0.035));
	const sw = $derived(big / 500);
	const off = $derived(fs * 3);
	const view = $derived(`${-off} ${yTop - off} ${L + off * 2} ${yFloor - yTop + off * 2.4}`);
	const dy = $derived(yFloor + fs * 1.6);
	const poly = (p: V2[]) => 'M' + p.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join('L') + 'Z';
	const paths = $derived.by(() => {
		const out = { a: '', b: '', ac: '', bc: '', thin: '' };
		for (const p of r.pieces) {
			const d = p.laid.map(poly).join('');
			if (p.thin) out.thin += d;
			else if (p.type === 0) p.cut ? (out.ac += d) : (out.a += d);
			else p.cut ? (out.bc += d) : (out.b += d);
		}
		return out;
	});
	const NAME = { window: 'Window', niche: 'Niche', door: 'Door' };

	// Section cuts: drag along the wall.
	let svgEl: SVGSVGElement;
	let drag: { i: number; x0: number; at: number; cx: number; moved: boolean; tag: boolean } | null = null;
	function localX(ev: PointerEvent): number {
		const m = svgEl?.getScreenCTM();
		if (!m) return 0;
		const pt = svgEl.createSVGPoint();
		pt.x = ev.clientX;
		pt.y = ev.clientY;
		return pt.matrixTransform(m.inverse()).x;
	}
	function down(ev: PointerEvent, i: number, tag: boolean) {
		if (!oncut && !oncutpick) return;
		ev.stopPropagation();
		ev.preventDefault();
		(ev.currentTarget as Element).setPointerCapture(ev.pointerId);
		drag = { i, x0: input.cuts[i].x, at: localX(ev), cx: ev.clientX, moved: false, tag };
	}
	function move(ev: PointerEvent) {
		if (!drag || !oncut) return;
		if (!drag.moved && Math.abs(ev.clientX - drag.cx) < 5) return;
		drag.moved = true;
		oncut(drag.i, Math.max(0.5, Math.min(L - 0.5, Math.round(drag.x0 + localX(ev) - drag.at))));
	}
	function up(ev: PointerEvent) {
		const d = drag;
		drag = null;
		if (d && !d.moved && ev.type !== 'pointercancel') oncutpick?.(d.i, d.tag);
	}
	let marksG: SVGGElement;
	$effect(() => {
		if (!marksG) return;
		void input.cuts.length;
		const stop = (e: Event) => e.preventDefault();
		const gs = [...marksG.querySelectorAll<SVGElement>('.grab')];
		for (const g of gs) g.addEventListener('touchstart', stop, { passive: false });
		return () => gs.forEach((g) => g.removeEventListener('touchstart', stop));
	});
	const uid = $props.id();
</script>

<svg viewBox={view} role="img" aria-label="Wall tile elevation" bind:this={svgEl}>
	<defs>
		<clipPath id="wall-{uid}"><rect x="0" y={yTop} width={L} height={yFloor - yTop} /></clipPath>
	</defs>
	<rect x="0" y={yTop} width={L} height={yFloor - yTop} class="wallbg" stroke-width={sw} />
	{#if input.start === 'tub'}
		<rect x="0" y={Y(input.tubHeight)} width={L} height={input.tubHeight} class="tub" stroke-width={sw * 2} />
		<text x={fs * 0.6} y={Y(input.tubHeight / 2) + fs * 0.35} font-size={fs * 0.85} class="lab">Tub or base, {ft(input.tubHeight)}</text>
	{/if}
	<g clip-path="url(#wall-{uid})" stroke-width={sw}>
		{#if r.approx}
			<rect x="0" y={Y(w.y1)} width={L} height={w.y1 - w.y0} class="pa" />
		{/if}
		<path d={paths.a} class="pa" />
		<path d={paths.ac} class="pa cut" />
		<path d={paths.b} class="pb" />
		<path d={paths.bc} class="pb cut" />
		<path d={paths.thin} class="thin" />
	</g>
	{#if r.approx}
		<text x={L / 2} y={Y((w.y0 + w.y1) / 2)} font-size={fs} class="lab" text-anchor="middle">Mosaic: counted by area</text>
	{/if}
	<!-- openings -->
	{#each input.openings as o, i (o.id)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<g class="op {o.kind}" class:sel={selected === i} onclick={() => onselect?.(i)}>
			<rect x={o.x} y={Y(o.sill + o.h)} width={o.w} height={o.h} stroke-width={sw * (selected === i ? 4 : 2)} />
			{#if o.kind === 'niche' && o.depth > 0}
				{@const k = Math.min(o.w, o.h) * 0.12}
				<rect x={o.x + k} y={Y(o.sill + o.h) + k} width={Math.max(0, o.w - 2 * k)} height={Math.max(0, o.h - 2 * k)} class="back" stroke-width={sw} />
			{/if}
			<text x={o.x + o.w / 2} y={Y(o.sill + o.h / 2) + fs * 0.35} font-size={fs * 0.85} text-anchor="middle" class="lab">{NAME[o.kind]}</text>
		</g>
	{/each}
	<!-- trim and ends -->
	{#if input.trimTop && input.top < input.ceiling - 0.5}
		<line x1="0" x2={L} y1={Y(input.top)} y2={Y(input.top)} class="trim" stroke-width={sw * 5} />
	{/if}
	{#each [[0, input.left], [L, input.right]] as [x, kind] (x)}
		<line x1={x} x2={x} y1={yTop} y2={yFloor} class={kind === 'edge' ? 'trim' : 'corner'} stroke-width={sw * (kind === 'edge' ? 5 : 8)} />
	{/each}
	<line x1={-off * 0.4} x2={L + off * 0.4} y1={yFloor} y2={yFloor} class="floor" stroke-width={sw * 6} />
	<!-- level and plumb lines -->
	{#each r.lines as l, i (i)}
		<line x1={l.p[0]} y1={l.p[1]} x2={l.q[0]} y2={l.q[1]} class="chalk" stroke-width={sw * 3} stroke-dasharray="{fs * 0.7} {fs * 0.35}" />
		<circle cx={l.p[0]} cy={l.p[1]} r={fs * 0.62} class="tag" />
		<text x={l.p[0]} y={l.p[1] + fs * 0.3} font-size={fs * 0.8} class="tagt" text-anchor="middle">{i ? 'B' : 'A'}</text>
	{/each}
	<!-- dimensions -->
	<line x1="0" x2={L} y1={dy} y2={dy} class="dim" stroke-width={sw * 1.5} />
	<line x1="0" x2="0" y1={dy - fs * 0.4} y2={dy + fs * 0.4} class="dim" stroke-width={sw * 1.5} />
	<line x1={L} x2={L} y1={dy - fs * 0.4} y2={dy + fs * 0.4} class="dim" stroke-width={sw * 1.5} />
	<text x={L / 2} y={dy + fs * 1.15} font-size={fs * 0.9} text-anchor="middle" class="dt">{ft(L)}</text>
	<text x={L + fs * 0.5} y={Y(input.top) + fs * 0.35} font-size={fs * 0.8} class="dt">{ft(input.top)}</text>
	<!-- section cuts -->
	<g bind:this={marksG}>
		{#each input.cuts as c, i (c.id)}
			{@const on = cutSel === i}
			{@const ta = yTop - fs * 1.5}
			<g class="cutm" class:on>
				<line x1={c.x} x2={c.x} y1={ta} y2={yFloor} class="cutl" stroke-width={sw * (on ? 4 : 2.6)} stroke-dasharray="{fs * 1.1} {fs * 0.3} {fs * 0.2} {fs * 0.3}" />
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<line x1={c.x} x2={c.x} y1={ta} y2={yFloor} class="grab hit" stroke-width={fs * 1.3} onpointerdown={(e) => down(e, i, false)} onpointermove={move} onpointerup={up} onpointercancel={up} />
				<path d="M{c.x + fs * 0.55},{ta}L{c.x - fs * 1.6},{ta}L{c.x + fs * 0.55},{ta - fs * 0.6}Z" class="arr" />
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g class="grab" onpointerdown={(e) => down(e, i, true)} onpointermove={move} onpointerup={up} onpointercancel={up}>
					<circle cx={c.x} cy={ta} r={fs * 0.78} class="tagc" stroke-width={sw * 2} />
					<text x={c.x} y={ta + fs * 0.3} font-size={fs * 0.8} class="cutt" text-anchor="middle">{i + 1}</text>
				</g>
			</g>
		{/each}
	</g>
</svg>
<div class="legend fine">
	<span><b>A</b> level, {ft(r.lines[0].dist)} off the {r.lines[0].side === 0 ? 'top' : 'bottom'}</span>
	<span><b>B</b> plumb, {ft(r.lines[1].dist)} off the {r.lines[1].side === 1 ? 'right' : 'left'} end</span>
	{#if r.smallest !== null}<span>smallest cut {ft(r.smallest)}</span>{/if}
</div>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: var(--drawing-h, 360px);
	}
	.wallbg {
		fill: var(--surface);
		stroke: var(--border);
	}
	.tub {
		fill: var(--surface-2);
		stroke: var(--muted);
	}
	.pa {
		fill: var(--concrete-top);
		stroke: var(--grout);
	}
	.pb {
		fill: var(--cmu);
		stroke: var(--grout);
	}
	.cut {
		fill-opacity: 0.55;
	}
	.thin {
		fill: var(--danger);
		fill-opacity: 0.55;
		stroke: var(--danger);
	}
	.op rect {
		stroke: var(--opening-edge);
		fill: var(--opening);
		cursor: pointer;
	}
	.op.niche rect {
		fill: var(--surface-2);
	}
	.op.niche .back {
		fill: var(--concrete-side);
	}
	.op.door rect {
		fill: var(--bg);
	}
	.op.sel rect:first-child {
		stroke: var(--primary);
	}
	.trim {
		stroke: var(--wood-header);
	}
	.corner {
		stroke: var(--muted);
	}
	.floor {
		stroke: var(--muted);
	}
	.lab {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
		pointer-events: none;
	}
	.dim {
		stroke: var(--muted);
	}
	.dt {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--text);
	}
	.chalk {
		stroke: var(--primary);
	}
	.tag {
		fill: var(--primary);
	}
	.tagt {
		font-family: var(--font-num);
		font-weight: 800;
		fill: var(--primary-ink);
	}
	.cutl {
		stroke: var(--text);
		opacity: 0.75;
	}
	.cutm.on .cutl {
		stroke: var(--green-dark);
		opacity: 1;
	}
	.hit {
		stroke: transparent;
		pointer-events: stroke;
		cursor: ew-resize;
	}
	.grab {
		cursor: grab;
	}
	.arr {
		fill: var(--text);
	}
	.cutm.on .arr {
		fill: var(--green-dark);
	}
	.tagc {
		fill: var(--surface);
		stroke: var(--text);
	}
	.cutm.on .tagc {
		stroke: var(--green-dark);
	}
	.cutt {
		font-family: var(--font-num);
		font-weight: 800;
		fill: var(--text);
		pointer-events: none;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 14px;
		margin: 2px 0 0;
		color: var(--muted);
	}
	.legend b {
		color: var(--primary-text);
	}
</style>
