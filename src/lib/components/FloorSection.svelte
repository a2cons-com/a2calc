<script lang="ts">
	// A section cut across the floor, as marked on the plan: the whole cut
	// wall to wall (heights stretched so the layers show), with each piece
	// it crosses, the chalk lines and the walls or doorways at its ends;
	// under it, both ends at true size: wall, base, the gap, the build-up
	// and the first piece's width along the cut.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import { BASE_H, BASE_T, floorSection, floorStack, SUBFLOOR, WALL_T, type FloorCut, type FloorInput, type FloorResult } from '$lib/takeoff/flooring';

	let { r, input, cut, num = 1 }: { r: FloorResult; input: FloorInput; cut: FloorCut; num?: number } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const sec = $derived(floorSection(r, cut));
	const stack = $derived(floorStack(input));
	const top = $derived(stack[stack.length - 1]);
	const ftop = $derived(top.y0 + top.h);
	const plank = $derived(input.material === 'plank');
	const gap = $derived(Math.max(0, input.gap));
	const uid = $props.id();

	// --- the strip ---
	const VW = 1000;
	const pad = 16;
	const fs = 26;
	const sx = $derived((VW - 2 * pad) / Math.max(1, sec.len + 2 * WALL_T));
	const X = (t: number) => pad + (t + WALL_T) * sx;
	const H = $derived(ftop + SUBFLOOR);
	/** Heights stretched to a readable band. */
	const k = $derived.by(() => {
		const raw = 64 / (H * sx);
		return [100, 50, 20, 10, 5, 2, 1].find((n) => n <= raw) ?? 1;
	});
	const wallTop = pad + fs * 1.5;
	const floorY = $derived(wallTop + H * sx * k * 0.9);
	const Y = (y: number) => floorY - (y - ftop) * sx * k;
	const dimY = $derived(Y(-SUBFLOOR) + fs * 0.9);

	/** Wall faces in the room's order: entering ones have the wall on their left. */
	const walls = $derived(sec.ends.map((e, i) => ({ ...e, x0: i % 2 ? e.t : e.t - WALL_T, x1: i % 2 ? e.t + WALL_T : e.t })));
	const stretches = $derived(sec.ends.flatMap((e, i) => (i % 2 ? [] : sec.ends[i + 1] ? [[e.t, sec.ends[i + 1].t] as [number, number]] : [])));

	// --- the details ---
	const DX0 = -3;
	const DX1 = 9;
	const DY0 = -SUBFLOOR - 1.3;
	const DY1 = $derived(ftop + 5.2);
	const dw = (VW - 2 * pad - 30) / 2;
	const m = dw / (DX1 - DX0);
	const dTop = $derived(dimY + fs * 2.4);
	const dTitle = $derived(dTop);
	const dBox = $derived(dTop + fs * 0.6);
	const dh = $derived((DY1 - DY0) * m);
	const VH = $derived(sec.ok ? dBox + dh + pad : 120);
	const dfs = 20;

	interface Detail {
		ox: number;
		/** x' (inches from the wall face, into the room) to svg x. */
		x: (v: number) => number;
		end: (typeof sec.ends)[number];
		/** Things at this end in x' (the pieces, the laid stretch). */
		pieces: { a: number; b: number; cut: boolean; thin: boolean; type: number }[];
		lay: [number, number][];
		mirror: boolean;
	}
	const dy = (y: number) => dBox + (DY1 - y) * m;
	const details = $derived.by((): Detail[] => {
		if (!sec.ok) return [];
		const first = sec.ends[0];
		const last = sec.ends[sec.ends.length - 1];
		const local = (mirror: boolean, t0: number) => (a: number, b: number): [number, number] => (mirror ? [t0 - b, t0 - a] : [a - t0, b - t0]);
		const mk = (end: typeof first, mirror: boolean, ox: number): Detail => {
			const L = local(mirror, end.t);
			const inWin = ([a, b]: [number, number]) => b > DX0 && a < DX1;
			const pieces = sec.pieces.map((p) => ({ ...p, ab: L(p.a, p.b) })).filter((p) => inWin(p.ab)).map((p) => ({ a: p.ab[0], b: p.ab[1], cut: p.cut, thin: p.thin, type: p.type }));
			pieces.sort((x, y) => x.a - y.a);
			const lay = sec.lay.map(([a, b]) => L(a, b)).filter(inWin);
			return { ox, x: mirror ? (v) => ox + (DX1 - v) * m : (v) => ox + (v - DX0) * m, end, pieces, lay, mirror };
		};
		return [mk(first, false, pad), mk(last, true, pad + dw + 30)];
	});
	const clip = (v: number) => Math.max(DX0, Math.min(DX1, v));
	const rectX = (d: Detail, a: number, b: number) => {
		const p = d.x(clip(a));
		const q = d.x(clip(b));
		return { x: Math.min(p, q), w: Math.abs(q - p) };
	};
	const short: Record<string, string> = { Underlayment: 'Underlay', 'Underlayment pad': 'Pad', '¾″ subfloor': 'Subfloor' };
	const fill = (p: { cut: boolean; thin: boolean; type: number }) => (p.thin ? 'thin' : p.type === 1 ? 'pb' : 'pa') + (p.cut && !p.thin ? ' cut' : '');
</script>

<svg viewBox="0 0 {VW} {VH}" role="img" aria-label="Floor section {num}">
	<defs>
		<pattern id="hatch-{uid}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
			<line x1="0" y1="0" x2="0" y2="10" class="hl" stroke-width="2" />
		</pattern>
		{#each details as d, i (i)}
			<clipPath id="win-{uid}-{i}"><rect x={d.ox} y={dBox} width={dw} height={dh} /></clipPath>
		{/each}
	</defs>
	{#if !sec.ok}
		<text x={VW / 2} y="64" font-size={fs} text-anchor="middle" class="note">Section {num} misses the room: drag it back onto the plan.</text>
	{:else}
		<!-- the whole cut, heights × k -->
		<rect x={X(-WALL_T)} y={Y(0)} width={X(sec.len + WALL_T) - X(-WALL_T)} height={Y(-SUBFLOOR) - Y(0)} class="sub" />
		{#each stack.slice(1, -1) as l (l.name)}
			{#each l.full ? stretches : sec.lay as [a, b], i (i)}
				<rect x={X(a)} y={Y(l.y0 + l.h)} width={X(b) - X(a)} height={l.h * sx * k} class={l.full ? 'under' : 'bed'} />
			{/each}
		{/each}
		<g class:plank>
			{#if r.approx}
				{#each sec.lay as [a, b], i (i)}
					<rect x={X(a)} y={Y(ftop)} width={X(b) - X(a)} height={top.h * sx * k} class="pa" />
				{/each}
			{:else}
				{#if !plank}
					{#each sec.lay as [a, b], i (i)}
						<rect x={X(a)} y={Y(ftop - 0.03)} width={X(b) - X(a)} height={(top.h - 0.03) * sx * k} class="bed" />
					{/each}
				{/if}
				{#each sec.pieces as p, i (i)}
					<rect x={X(p.a)} y={Y(ftop)} width={Math.max(0.5, X(p.b) - X(p.a))} height={top.h * sx * k} class={fill(p)} stroke-width="1" />
				{/each}
			{/if}
		</g>
		{#each walls as w, i (i)}
			{#if w.door}
				<line x1={X(w.x0)} x2={X(w.x1)} y1={Y(ftop)} y2={Y(ftop)} class="door" stroke-width="3" />
				<text x={X((w.x0 + w.x1) / 2)} y={wallTop - fs * 0.3} font-size={fs * 0.75} text-anchor="middle" class="wl">Door</text>
			{:else}
				<rect x={X(w.x0)} y={wallTop} width={X(w.x1) - X(w.x0)} height={Y(0) - wallTop} class="wall" fill="url(#hatch-{uid})" stroke-width="1.5" />
				<text x={X((w.x0 + w.x1) / 2)} y={wallTop - fs * 0.3} font-size={fs * 0.75} text-anchor="middle" class="wl">{w.wall + 1}</text>
			{/if}
		{/each}
		{#each sec.lines as l (l.name)}
			<line x1={X(l.t)} x2={X(l.t)} y1={wallTop + fs * 0.4} y2={Y(-SUBFLOOR)} class="chalk" stroke-width="2" stroke-dasharray="8 5" />
			<circle cx={X(l.t)} cy={wallTop} r={fs * 0.5} class="tag" />
			<text x={X(l.t)} y={wallTop + fs * 0.27} font-size={fs * 0.7} text-anchor="middle" class="tagt">{l.name}</text>
		{/each}
		<!-- dimensions: each stretch wall to wall -->
		{#each stretches as [a, b], i (i)}
			<line x1={X(a)} x2={X(b)} y1={dimY} y2={dimY} class="dim" stroke-width="1.5" />
			<line x1={X(a)} x2={X(a)} y1={dimY - 8} y2={dimY + 8} class="dim" stroke-width="1.5" />
			<line x1={X(b)} x2={X(b)} y1={dimY - 8} y2={dimY + 8} class="dim" stroke-width="1.5" />
			<text x={(X(a) + X(b)) / 2} y={dimY + fs * 0.95} font-size={fs * 0.8} text-anchor="middle" class="dt">{ft(b - a)}</text>
		{/each}
		<text x={VW - pad} y={dimY + fs * 0.95} font-size={fs * 0.6} text-anchor="end" class="note">heights ×{k}</text>

		<!-- the ends, true size -->
		{#each details as d, di (di)}
			{@const anchor = d.mirror ? 'end' : 'start'}
			{@const first = d.pieces.find((p) => p.b > 0.01)}
			<text x={d.mirror ? d.ox + dw : d.ox} y={dTitle} font-size={dfs} text-anchor={anchor} class="dtitle">{d.end.door ? `At the doorway, wall ${d.end.wall + 1}` : `At wall ${d.end.wall + 1}`} · true size</text>
			<g clip-path="url(#win-{uid}-{di})">
				<rect x={d.ox} width={dw} y={dy(0)} height={SUBFLOOR * m} class="sub" />
				{#each stack.slice(1, -1) as l (l.name)}
					{#each l.full ? [[d.end.door ? DX0 : 0, DX1] as [number, number]] : d.lay as [a, b], i (i)}
						{@const rx = rectX(d, a, b)}
						<rect x={rx.x} width={rx.w} y={dy(l.y0 + l.h)} height={l.h * m} class={l.full ? 'under' : 'bed'} />
					{/each}
				{/each}
				<g class:plank>
					{#if r.approx}
						{#each d.lay as [a, b], i (i)}
							{@const rx = rectX(d, a, b)}
							<rect x={rx.x} width={rx.w} y={dy(ftop)} height={top.h * m} class="pa" />
						{/each}
					{:else}
						{#if !plank}
							{#each d.lay as [a, b], i (i)}
								{@const rx = rectX(d, a, b)}
								<rect x={rx.x} width={rx.w} y={dy(ftop - 0.03)} height={(top.h - 0.03) * m} class="bed" />
							{/each}
						{/if}
						{#each d.pieces as p, i (i)}
							{@const rx = rectX(d, p.a, p.b)}
							<rect x={rx.x} width={rx.w} y={dy(ftop)} height={top.h * m} class={fill(p)} stroke-width="1.2" />
						{/each}
					{/if}
				</g>
				{#if d.end.door}
					{@const g = gap}
					<path d="M{d.x(-1.6)},{dy(ftop * 0.2)} L{d.x(-0.9)},{dy(ftop + 0.15)} L{d.x(g + 0.55)},{dy(ftop + 0.15)} L{d.x(g + 1.2)},{dy(ftop)} Z" class="trans" stroke-width="1.2" />
					<text x={d.x(-0.4)} y={dy(ftop + 1.2)} font-size={dfs} text-anchor={d.mirror ? 'end' : 'start'} class="lab">Transition</text>
				{:else}
					{@const wx = rectX(d, -WALL_T, 0)}
					<rect x={wx.x} width={wx.w} y={dy(DY1)} height={dy(0) - dy(DY1)} class="wall" fill="url(#hatch-{uid})" stroke-width="1.5" />
					{@const dr = rectX(d, -0.5, 0)}
					<rect x={dr.x} width={dr.w} y={dy(DY1)} height={dy(0) - dy(DY1)} class="dry" stroke-width="1" />
					{#if !plank && gap > 0}
						{@const cx = rectX(d, 0, gap)}
						<rect x={cx.x} width={cx.w} y={dy(ftop)} height={(ftop - top.y0) * m} class="caulk" />
					{/if}
					{#if input.base}
						{@const bx = rectX(d, 0, BASE_T)}
						<rect x={bx.x} width={bx.w} y={dy(ftop + BASE_H)} height={BASE_H * m} class="base" stroke-width="1.2" />
						<text x={d.x(BASE_T + 0.35)} y={dy(ftop + BASE_H / 2)} font-size={dfs} text-anchor={anchor} class="lab">Base</text>
					{/if}
				{/if}
			</g>
			<rect x={d.ox} y={dBox} width={dw} height={dh} class="frame" stroke-width="1" />
			<!-- the layers, named (left end only) -->
			{#if !d.mirror}
				{#each [...stack].reverse() as l, i (l.name)}
					{@const ry = dy(ftop + 4.6) + i * dfs * 1.25}
					{@const lx = d.x(3 + i * 0.4)}
					<line x1={lx} x2={lx} y1={ry - dfs * 0.35} y2={dy(l.y0 + l.h / 2)} class="lead" stroke-width="1" />
					<line x1={lx} x2={d.x(4.3)} y1={ry - dfs * 0.35} y2={ry - dfs * 0.35} class="lead" stroke-width="1" />
					<circle cx={lx} cy={dy(l.y0 + l.h / 2)} r="2.5" class="leadot" />
					<text x={d.x(4.4)} y={ry} font-size={dfs} class="lab">{(short[l.name] ?? l.name)} {ft(l.h)}</text>
				{/each}
			{/if}
			<!-- gap and first piece along the cut -->
			{@const yy = dy(DY0 + 0.75)}
			{#if !d.end.door && gap > 0}
				<line x1={d.x(0)} x2={d.x(0)} y1={yy - 7} y2={yy + 7} class="dim" stroke-width="1.2" />
				<text x={d.x(-0.25)} y={yy + dfs * 0.35} font-size={dfs * 0.9} text-anchor={d.mirror ? 'start' : 'end'} class="dt">{ft(gap)} gap</text>
			{/if}
			{#if first && !r.approx}
				{@const a = Math.max(0, first.a)}
				<line x1={d.x(a)} x2={d.x(clip(first.b))} y1={yy} y2={yy} class="dim" stroke-width="1.2" />
				<line x1={d.x(a)} x2={d.x(a)} y1={yy - 7} y2={yy + 7} class="dim" stroke-width="1.2" />
				{#if first.b <= DX1}<line x1={d.x(first.b)} x2={d.x(first.b)} y1={yy - 7} y2={yy + 7} class="dim" stroke-width="1.2" />{/if}
				<text x={d.x(a + 0.4)} y={yy - dfs * 0.45} font-size={dfs * 0.9} text-anchor={anchor} class="dt" class:bad={first.thin}>{ft(first.b - first.a)}{first.cut ? ' cut' : ' full'}</text>
			{/if}
		{/each}
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: var(--drawing-h, 420px);
	}
	.sub {
		fill: var(--plate);
		stroke: var(--wood-edge);
		stroke-width: 1;
	}
	.under {
		fill: var(--concrete-side);
	}
	.bed {
		fill: var(--grout);
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
		fill-opacity: 0.6;
	}
	.thin {
		fill: var(--danger);
		fill-opacity: 0.6;
		stroke: var(--danger);
	}
	.wall {
		stroke: var(--muted);
	}
	.hl {
		stroke: var(--border);
	}
	.dry {
		fill: var(--surface);
		stroke: var(--muted);
	}
	.caulk {
		fill: var(--surface-2);
	}
	.base {
		fill: var(--wood-header);
		stroke: var(--wood-edge);
	}
	.trans {
		fill: var(--wood-header);
		stroke: var(--wood-edge);
	}
	.door {
		stroke: var(--muted);
	}
	.frame {
		fill: none;
		stroke: var(--border);
	}
	.wl,
	.dt,
	.lab,
	.dtitle {
		font-family: var(--font-num);
		fill: var(--muted);
	}
	.wl,
	.dtitle {
		font-weight: 700;
	}
	.lab {
		fill: var(--text);
	}
	.dt {
		fill: var(--text);
		font-weight: 600;
	}
	.dt.bad {
		fill: var(--danger);
	}
	.dim,
	.lead {
		stroke: var(--muted);
	}
	.leadot {
		fill: var(--muted);
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
	.note {
		font-family: var(--font-num);
		fill: var(--muted);
	}
</style>
