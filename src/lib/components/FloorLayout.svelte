<script lang="ts">
	// The floor from above: the walls (tap one to pick it), doorways, every
	// piece as laid (cut ones lighter, slivers red), and the two chalk lines
	// the layout is set out from, each with its distance off its wall.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import { cutAt, cutOffWall, floorSection, type FloorCut, type FloorInput, type FloorResult, type V2 } from '$lib/takeoff/flooring';

	let {
		r,
		input,
		selected = -1,
		onselect,
		cuts = [],
		cutSel = -1,
		oncut,
		oncutpick
	}: {
		r: FloorResult;
		input: FloorInput;
		selected?: number;
		onselect?: (i: number) => void;
		/** Section cuts to mark; with `oncut` they drag (the line slides, an end tag turns it). */
		cuts?: FloorCut[];
		cutSel?: number;
		oncut?: (i: number, c: Pick<FloorCut, 'p' | 'deg'>) => void;
		/** A tap on a cut: its line (`open` false) or an end tag (open it). */
		oncutpick?: (i: number, open: boolean) => void;
	} = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const bb = $derived(
		r.room.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity])
	);
	const big = $derived(Math.max(bb[2] - bb[0], bb[3] - bb[1], 12));
	const fs = $derived(Math.max(3, big * 0.035));
	const sw = $derived(big / 500);
	const wallT = $derived(Math.max(3, big * 0.018));
	const off = $derived(fs * (cuts.length ? 4.2 : 2.6));
	const view = $derived(`${bb[0] - off} ${bb[1] - off} ${bb[2] - bb[0] + off * 2} ${bb[3] - bb[1] + off * 2}`);

	const poly = (p: V2[]) => 'M' + p.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join('L') + 'Z';
	const plank = $derived(input.material === 'plank');
	/** One path per look, so thousands of pieces stay light. */
	const paths = $derived.by(() => {
		const out = { a: '', b: '', ac: '', bc: '', thin: '' };
		for (const p of r.pieces) {
			const d = poly(p.poly);
			if (p.thin) out.thin += d;
			else if (p.type === 0) p.cut ? (out.ac += d) : (out.a += d);
			else p.cut ? (out.bc += d) : (out.b += d);
		}
		return out;
	});
	const mid = (a: V2, b: V2): V2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const outer = (i: number, k: number): V2 => {
		const w = r.walls[i];
		const m = mid(w.a, w.b);
		return [m[0] - w.n[0] * k, m[1] - w.n[1] * k];
	};
	const doors = $derived(
		r.walls.flatMap((w, i) =>
			(input.rect && i >= 2 ? input.sides[i] : input.sides[i])?.doors.map((d) => {
				const a: V2 = [w.a[0] + w.d[0] * d.at, w.a[1] + w.d[1] * d.at];
				const b: V2 = [a[0] + w.d[0] * d.width, a[1] + w.d[1] * d.width];
				return { a, b, n: w.n, id: d.id };
			}) ?? []
		)
	);
	const uid = $props.id();

	// Section marks: the cut across the room and past the walls, a tag at
	// each end with the arrow the way it looks.
	const marks = $derived(
		cuts.map((c) => {
			const sec = floorSection(r, c);
			const e = sec.e;
			const ext = fs * 2.3;
			const a: V2 = sec.ok ? sec.p : [c.p[0] - e[0] * big * 0.25, c.p[1] - e[1] * big * 0.25];
			const b: V2 = sec.ok ? sec.q : [c.p[0] + e[0] * big * 0.25, c.p[1] + e[1] * big * 0.25];
			const P: V2 = [a[0] - e[0] * ext, a[1] - e[1] * ext];
			const Q: V2 = [b[0] + e[0] * ext, b[1] + e[1] * ext];
			const R = fs * 0.62;
			const tagAt = (x: V2, s: number): V2 => [x[0] + e[0] * R * s, x[1] + e[1] * R * s];
			const arrow = (t: V2) => {
				const tip: V2 = [t[0] + sec.n[0] * R * 1.9, t[1] + sec.n[1] * R * 1.9];
				const l: V2 = [t[0] + e[0] * R * 0.95, t[1] + e[1] * R * 0.95];
				const rr: V2 = [t[0] - e[0] * R * 0.95, t[1] - e[1] * R * 0.95];
				return `M${l[0]},${l[1]}L${tip[0]},${tip[1]}L${rr[0]},${rr[1]}Z`;
			};
			const tp = tagAt(P, -1);
			const tq = tagAt(Q, 1);
			return { ok: sec.ok, P, Q, tp, tq, R, ap: arrow(tp), aq: arrow(tq), mid: sec.ok ? sec.mid : c.p, n: sec.n, e };
		})
	);

	let svgEl: SVGSVGElement;
	function local(ev: PointerEvent): V2 {
		const mtx = svgEl?.getScreenCTM();
		if (!mtx) return [0, 0];
		const pt = svgEl.createSVGPoint();
		pt.x = ev.clientX;
		pt.y = ev.clientY;
		const q = pt.matrixTransform(mtx.inverse());
		return [q.x, q.y];
	}
	let drag: { i: number; mode: 'move' | 'turn'; end: number; at: V2; x: number; y: number; p0: V2; moved: boolean } | null = null;
	function down(ev: PointerEvent, i: number, mode: 'move' | 'turn', end = 1) {
		if (!oncut && !oncutpick) return;
		ev.stopPropagation();
		ev.preventDefault();
		(ev.currentTarget as Element).setPointerCapture(ev.pointerId);
		drag = { i, mode, end, at: local(ev), x: ev.clientX, y: ev.clientY, p0: [...cuts[i].p] as V2, moved: false };
	}
	function move(ev: PointerEvent) {
		if (!drag || !oncut) return;
		if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 5) return;
		drag.moved = true;
		const c = cuts[drag.i];
		const mk = marks[drag.i];
		const pt = local(ev);
		if (drag.mode === 'move') {
			const k = (pt[0] - drag.at[0]) * mk.n[0] + (pt[1] - drag.at[1]) * mk.n[1];
			const next: FloorCut = { ...c, p: [drag.p0[0] + mk.n[0] * k, drag.p0[1] + mk.n[1] * k] };
			const ow = cutOffWall(r, next);
			oncut(drag.i, { p: ow ? cutAt(r, next, ow.side, Math.round(ow.dist)) : next.p, deg: c.deg });
		} else {
			// The dragged end's way from the middle is e (or -e for the start).
			const ang = (Math.atan2(pt[1] - mk.mid[1], pt[0] - mk.mid[0]) * 180) / Math.PI + (drag.end > 0 ? 0 : 180);
			// e = d when flipped, -d otherwise.
			let deg = Math.round((ang + (c.flip ? 0 : 180)) / 5) * 5;
			deg = ((((deg + 180) % 360) + 360) % 360) - 180;
			if (deg !== c.deg) oncut(drag.i, { p: [mk.mid[0], mk.mid[1]], deg });
		}
	}
	function up(ev: PointerEvent) {
		const d = drag;
		drag = null;
		if (d && !d.moved && ev.type !== 'pointercancel') oncutpick?.(d.i, d.mode === 'turn');
	}
	// A touch on a mark drags it rather than scrolling the page.
	let marksG: SVGGElement;
	$effect(() => {
		if (!marksG) return;
		void cuts.length;
		const stop = (e: Event) => e.preventDefault();
		const gs = [...marksG.querySelectorAll<SVGElement>('.grab')];
		for (const g of gs) g.addEventListener('touchstart', stop, { passive: false });
		return () => gs.forEach((g) => g.removeEventListener('touchstart', stop));
	});
</script>

<svg viewBox={view} role="img" aria-label="Floor layout" bind:this={svgEl}>
	<defs>
		<clipPath id="lay-{uid}"><path d={poly(r.lay)} /></clipPath>
	</defs>
	<path d={poly(r.room)} class="sub" stroke-width={sw} />
	<g clip-path="url(#lay-{uid})" stroke-width={sw} class:plank>
		<path d={paths.a} class="pa" />
		<path d={paths.ac} class="pa cut" />
		<path d={paths.b} class="pb" />
		<path d={paths.bc} class="pb cut" />
		<path d={paths.thin} class="thin" />
	</g>
	{#if r.approx}
		<text x={(bb[0] + bb[2]) / 2} y={(bb[1] + bb[3]) / 2} font-size={fs} class="note" text-anchor="middle">Mosaic: counted by area</text>
	{/if}
	<!-- walls, outside the inside faces; tap one to pick it -->
	{#each r.walls as w, i (i)}
		{@const o = (k: number): V2 => [-w.n[0] * k, -w.n[1] * k]}
		{@const a = o(wallT / 2)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<line
			x1={w.a[0] + a[0] - w.d[0] * wallT}
			y1={w.a[1] + a[1] - w.d[1] * wallT}
			x2={w.b[0] + a[0] + w.d[0] * wallT}
			y2={w.b[1] + a[1] + w.d[1] * wallT}
			class="wall"
			class:sel={selected === i}
			stroke-width={wallT}
			onclick={() => onselect?.(i)}
		/>
		{@const t = outer(i, wallT + fs * 1.1)}
		<text x={t[0]} y={t[1] + fs * 0.35} font-size={fs * 0.8} class="wl" class:sel={selected === i} text-anchor="middle" pointer-events="none">{i + 1}</text>
	{/each}
	{#each doors as d (d.id)}
		<line x1={d.a[0] - d.n[0] * wallT / 2} y1={d.a[1] - d.n[1] * wallT / 2} x2={d.b[0] - d.n[0] * wallT / 2} y2={d.b[1] - d.n[1] * wallT / 2} class="door" stroke-width={wallT * 1.2} />
	{/each}
	<!-- the chalk lines -->
	{#each r.lines as l, i (i)}
		<line x1={l.p[0]} y1={l.p[1]} x2={l.q[0]} y2={l.q[1]} class="chalk" stroke-width={sw * 3} stroke-dasharray="{fs * 0.7} {fs * 0.35}" />
		<circle cx={l.p[0]} cy={l.p[1]} r={fs * 0.62} class="tag" />
		<text x={l.p[0]} y={l.p[1] + fs * 0.3} font-size={fs * 0.8} class="tagt" text-anchor="middle">{i ? 'B' : 'A'}</text>
	{/each}
	<!-- section cuts -->
	<g bind:this={marksG}>
		{#each marks as mk, i (cuts[i].id)}
			{@const on = cutSel === i}
			<g class="cutm" class:on class:off={!mk.ok}>
				<line x1={mk.P[0]} y1={mk.P[1]} x2={mk.Q[0]} y2={mk.Q[1]} class="cutl" stroke-width={sw * (on ? 4 : 2.6)} stroke-dasharray="{fs * 1.1} {fs * 0.3} {fs * 0.2} {fs * 0.3}" />
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<line
					x1={mk.P[0]}
					y1={mk.P[1]}
					x2={mk.Q[0]}
					y2={mk.Q[1]}
					class="grab hit"
					class:movable={!!oncut}
					stroke-width={fs * 1.3}
					onpointerdown={(e) => down(e, i, 'move')}
					onpointermove={move}
					onpointerup={up}
					onpointercancel={up}
				/>
				{#each [[mk.tp, mk.ap, -1], [mk.tq, mk.aq, 1]] as [t, a, end] (end)}
					{@const c = t as V2}
					<path d={a as string} class="arr" />
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g class="grab" class:movable={!!oncut} onpointerdown={(e) => down(e, i, 'turn', end as number)} onpointermove={move} onpointerup={up} onpointercancel={up}>
						<circle cx={c[0]} cy={c[1]} r={mk.R * 1.25} class="tagc" stroke-width={sw * 2} />
						<text x={c[0]} y={c[1] + fs * 0.3} font-size={fs * 0.8} class="cutt" text-anchor="middle">{i + 1}</text>
					</g>
				{/each}
			</g>
		{/each}
	</g>
</svg>
<div class="legend fine">
	<span><b>A</b> {ft(r.lines[0].dist)} off wall {r.lines[0].side + 1}</span>
	<span><b>B</b> {ft(r.lines[1].dist)} off wall {r.lines[1].side + 1}</span>
	{#if r.smallest !== null}<span>smallest cut {ft(r.smallest)}</span>{/if}
</div>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: var(--drawing-h, 320px);
	}
	.sub {
		fill: var(--bg);
		stroke: var(--border);
	}
	.pa {
		fill: var(--concrete-top);
		stroke: var(--grout);
	}
	.pb {
		fill: var(--cmu);
		stroke: var(--grout);
	}
	.plank .pa,
	.plank .pb {
		fill: var(--wood);
		stroke: var(--wood-edge);
	}
	.cut {
		fill-opacity: 0.55;
	}
	.thin {
		fill: var(--danger);
		fill-opacity: 0.55;
		stroke: var(--danger);
	}
	.wall {
		stroke: var(--muted);
		cursor: pointer;
	}
	.wall.sel {
		stroke: var(--primary);
	}
	.door {
		stroke: var(--surface);
	}
	.wl {
		font-family: var(--font-num);
		font-weight: 700;
		fill: var(--muted);
	}
	.wl.sel {
		fill: var(--primary-text);
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
	.cutm.off .cutl {
		opacity: 0.35;
	}
	.cutm.on .cutl {
		stroke: var(--green-dark);
		opacity: 1;
	}
	.hit {
		stroke: transparent;
		pointer-events: stroke;
	}
	.movable.hit {
		cursor: move;
	}
	.grab.movable {
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
	.note {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
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
