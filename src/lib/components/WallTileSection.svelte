<script lang="ts">
	// A plumb section through the tiled wall where it is cut on the
	// elevation: the wall's whole height on the left (thickness stretched so
	// the layers show), with every piece the cut crosses, the tub or floor
	// it starts on, windows and niches and the trim; on the right the top
	// and the bottom of the tile at true size.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import { floorSection } from '$lib/takeoff/flooring';
	import type { WallTileInput, WallTileResult } from '$lib/takeoff/walltile';

	let { w, input, x, num = 1 }: { w: WallTileResult; input: WallTileInput; x: number; num?: number } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const H = $derived(w.y1 - w.y0);
	const sec = $derived(floorSection(w.f, { id: 0, p: [x, H / 2], deg: 90, flip: false }));
	/** Heights of what the cut crosses (t runs up from the tile's bottom). */
	const pieces = $derived(sec.pieces.map((p) => ({ ...p, h0: w.y0 + p.a, h1: w.y0 + p.b })));
	const holes = $derived(w.holes.filter((h) => x >= h.x0 && x <= h.x1).map((h) => ({ ...h, o: input.openings.find((o) => o.id === h.id)! })));
	const backer = $derived(input.backerSqft > 0);

	// Through the wall: 0 the stud face, + into the room.
	const STUD = 3.5;
	const BK = 0.5;
	const TS = 3 / 16;
	const TH = $derived(Math.max(0.125, input.thick));
	const face = $derived(BK + TS + TH);
	const TUB = 5;

	const pad = 16;
	const fs = 22;
	// The strip
	const hMin = -1;
	const hMax = $derived(Math.max(input.ceiling, input.top + 2));
	const SH = 820;
	const sy = $derived(SH / (hMax - hMin));
	const SW = 190;
	const uMin = -STUD;
	const uMax = $derived(face + TUB + 1);
	const kx = $derived(SW / (uMax - uMin));
	const sx0 = pad + fs * 2.2;
	const SX = (u: number) => sx0 + (u - uMin) * kx;
	const top0 = pad + fs * 1.6;
	const SY = (h: number) => top0 + (hMax - h) * sy;
	const stretch = $derived(Math.max(1, Math.round(kx / sy)));

	// The details, true size, to the right of the strip.
	const dx0 = $derived(sx0 + SW + 40);
	const DW = 300;
	const DU0 = -STUD;
	const DU1 = 4.5;
	const m = DW / (DU1 - DU0);
	const DHin = 7;
	const DH = DHin * m;
	const DX = (u: number) => dx0 + (u - DU0) * m;
	const VW = $derived(dx0 + DW + pad);
	const VH = $derived(top0 + SH + fs * 2.2);
	interface Det {
		title: string;
		/** Height at the window's middle, and the box's top in svg. */
		mid: number;
		y: number;
	}
	const dets = $derived.by((): Det[] => {
		const topH = pieces.length ? pieces[pieces.length - 1].h1 : w.y1;
		const botH = pieces.length ? pieces[0].h0 : w.y0;
		return [
			{ title: 'Top of the tile', mid: topH, y: top0 + fs * 0.6 },
			{ title: input.start === 'tub' ? 'At the tub' : 'At the floor', mid: botH + 1, y: top0 + DH + fs * 3.2 }
		];
	});
	const DY = (d: Det, h: number) => d.y + (d.mid + DHin / 2 - h) * m;
	const fill = (p: { cut: boolean; thin: boolean; type: number }) => (p.thin ? 'thin' : p.type === 1 ? 'pb' : 'pa') + (p.cut && !p.thin ? ' cut' : '');
	const uid = $props.id();
</script>

<svg viewBox="0 0 {VW} {VH}" role="img" aria-label="Wall tile section {num}">
	<defs>
		<pattern id="h-{uid}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
			<line x1="0" y1="0" x2="0" y2="10" class="hl" stroke-width="2" />
		</pattern>
		{#each dets as d, i (i)}
			<clipPath id="d-{uid}-{i}"><rect x={dx0} y={d.y} width={DW} height={DH} /></clipPath>
		{/each}
	</defs>
	{#if !sec.ok}
		<text x={VW / 2} y="60" font-size={fs} text-anchor="middle" class="lab">Section {num} is off the wall.</text>
	{:else}
		{#snippet build(X: (u: number) => number, Yf: (h: number) => number, sw: number)}
			<!-- floor, studs, backer or drywall -->
			<rect x={X(uMin)} y={Yf(0)} width={X(uMax) - X(uMin)} height={Yf(-0.75) - Yf(0)} class="sub" />
			<rect x={X(-STUD)} y={Yf(hMax)} width={X(0) - X(-STUD)} height={Yf(0) - Yf(hMax)} class="stud" fill="url(#h-{uid})" stroke-width={sw} />
			<rect x={X(0)} y={Yf(hMax)} width={X(BK) - X(0)} height={Yf(w.y1) - Yf(hMax)} class="dry" stroke-width={sw} />
			<rect x={X(0)} y={Yf(w.y1)} width={X(BK) - X(0)} height={Yf(input.start === 'tub' ? input.tubHeight - 1 : 0) - Yf(w.y1)} class={backer ? 'backer' : 'dry'} stroke-width={sw} />
			{#each sec.lay as [a, b], i (i)}
				<rect x={X(BK)} y={Yf(w.y0 + b)} width={X(BK + TS) - X(BK)} height={Yf(w.y0 + a) - Yf(w.y0 + b)} class="bed" />
				<rect x={X(BK + TS)} y={Yf(w.y0 + b)} width={X(face - 0.03) - X(BK + TS)} height={Yf(w.y0 + a) - Yf(w.y0 + b)} class="bed" />
			{/each}
			{#if w.f.approx}
				{#each sec.lay as [a, b], i (i)}
					<rect x={X(BK + TS)} y={Yf(w.y0 + b)} width={X(face) - X(BK + TS)} height={Yf(w.y0 + a) - Yf(w.y0 + b)} class="pa" />
				{/each}
			{:else}
				{#each pieces as p, i (i)}
					<rect x={X(BK + TS)} y={Yf(p.h1)} width={X(face) - X(BK + TS)} height={Math.max(0.5, Yf(p.h0) - Yf(p.h1))} class={fill(p)} stroke-width={sw} />
				{/each}
			{/if}
			{#if input.start === 'tub'}
				<rect x={X(BK - 0.25)} y={Yf(input.tubHeight)} width={X(face + TUB) - X(BK - 0.25)} height={Yf(0) - Yf(input.tubHeight)} class="tub" stroke-width={sw * 1.4} />
				<rect x={X(BK + TS)} y={Yf(w.y0 + Math.max(0.06, input.gap))} width={X(face) - X(BK + TS)} height={Yf(w.y0) - Yf(w.y0 + Math.max(0.06, input.gap))} class="caulk" />
			{/if}
			{#each holes as h (h.id)}
				{@const hh0 = input.top - h.y1}
				{@const hh1 = input.top - h.y0}
				{#if h.kind === 'niche'}
					<rect x={X(-Math.min(STUD, Math.max(0.5, h.o.depth)) + BK)} y={Yf(hh1)} width={X(face) - X(-Math.min(STUD, Math.max(0.5, h.o.depth)) + BK)} height={Yf(hh0) - Yf(hh1)} class="niche" stroke-width={sw} />
				{:else if h.kind === 'window'}
					<rect x={X(-STUD)} y={Yf(hh1)} width={X(face) - X(-STUD)} height={Yf(hh0) - Yf(hh1)} class="win" stroke-width={sw} />
					<line x1={X(-STUD / 2)} x2={X(-STUD / 2)} y1={Yf(hh1)} y2={Yf(hh0)} class="glass" stroke-width={sw * 2} />
				{:else}
					<rect x={X(-STUD)} y={Yf(hh1)} width={X(face) - X(-STUD)} height={Yf(hh0) - Yf(hh1)} class="door" stroke-width={sw} />
				{/if}
			{/each}
			{#if input.trimTop && input.top < input.ceiling - 0.5}
				{@const th = pieces.length ? pieces[pieces.length - 1].h1 : w.y1}
				<path d="M{X(BK + TS)},{Yf(th + 0.08)} L{X(face + 0.08)},{Yf(th + 0.08)} L{X(face + 0.08)},{Yf(th - 0.3)} L{X(face)},{Yf(th - 0.3)} L{X(face)},{Yf(th)} L{X(BK + TS)},{Yf(th)} Z" class="trimp" stroke-width={sw} />
			{/if}
		{/snippet}

		<!-- the whole height -->
		<text x={sx0} y={pad + fs * 0.4} font-size={fs * 0.75} class="dtitle">Section {num}, thickness ×{stretch}</text>
		{@render build(SX, SY, 1)}
		{#each [[w.y0, 'from'], [w.y1, 'to']] as [h, k] (k)}
			<line x1={SX(uMax) + 4} x2={SX(uMax) + 14} y1={SY(h as number)} y2={SY(h as number)} class="dim" stroke-width="1.2" />
		{/each}
		<line x1={SX(uMax) + 9} x2={SX(uMax) + 9} y1={SY(w.y1)} y2={SY(w.y0)} class="dim" stroke-width="1.2" />
		<text x={SX(uMax) + 4} y={(SY(w.y0) + SY(w.y1)) / 2} font-size={fs * 0.8} class="dt" transform="rotate(-90 {SX(uMax) + 4} {(SY(w.y0) + SY(w.y1)) / 2})" text-anchor="middle">{ft(w.y1 - w.y0)} of tile</text>
		<text x={sx0 - 6} y={SY(0) - 4} font-size={fs * 0.7} text-anchor="end" class="lab">0</text>
		<text x={sx0 - 6} y={SY(w.y1) + fs * 0.25} font-size={fs * 0.7} text-anchor="end" class="lab">{ft(w.y1)}</text>
		{#if w.y0 > 0}<text x={sx0 - 6} y={SY(w.y0) + fs * 0.25} font-size={fs * 0.7} text-anchor="end" class="lab">{ft(w.y0)}</text>{/if}
		{#each sec.lines as l (l.name)}
			<line x1={sx0 - 4} x2={SX(uMax)} y1={SY(w.y0 + l.t)} y2={SY(w.y0 + l.t)} class="chalk" stroke-width="2" stroke-dasharray="8 5" />
			<circle cx={sx0 - fs * 0.6} cy={SY(w.y0 + l.t)} r={fs * 0.5} class="tag" />
			<text x={sx0 - fs * 0.6} y={SY(w.y0 + l.t) + fs * 0.27} font-size={fs * 0.7} text-anchor="middle" class="tagt">{l.name}</text>
		{/each}

		<!-- top and bottom, true size -->
		{#each dets as d, di (di)}
			{@const Yd = (h: number) => DY(d, h)}
			{@const edge = di === 0 ? pieces[pieces.length - 1] : pieces[0]}
			<text x={dx0} y={d.y - 8} font-size={fs * 0.8} class="dtitle">{d.title} · true size</text>
			<g clip-path="url(#d-{uid}-{di})">
				{@render build(DX, Yd, 1.2)}
			</g>
			<rect x={dx0} y={d.y} width={DW} height={DH} class="frame" stroke-width="1" />
			{#if di === 0}
				<!-- the layers, named -->
				{#each [['Stud', -STUD / 2, '2×4'], [backer ? 'Backer' : 'Drywall', BK / 2, ft(BK)], ['Thinset', BK + TS / 2, ft(TS)], ['Tile', face - TH / 2, ft(TH)]] as [name, u, t], i (name)}
					{@const ly = d.y + fs * 1.1 + i * fs * 1.05}
					{@const to = Yd(d.mid - 0.8)}
					<line x1={DX(u as number)} x2={DX(u as number)} y1={ly - fs * 0.3} y2={to} class="lead" stroke-width="1" />
					<circle cx={DX(u as number)} cy={to} r="2.5" class="leadot" />
					<line x1={DX(u as number)} x2={DX(2.1)} y1={ly - fs * 0.3} y2={ly - fs * 0.3} class="lead" stroke-width="1" />
					<text x={DX(2.2)} y={ly} font-size={fs * 0.75} class="lab">{name} {t}</text>
				{/each}
				{#if input.trimTop && input.top < input.ceiling - 0.5}
					<text x={DX(face + 0.9)} y={Yd(d.mid + 0.35)} font-size={fs * 0.7} class="lab">Edge trim</text>
				{/if}
			{:else if input.start === 'tub'}
				<text x={DX(face + 0.6)} y={Yd(w.y0 - 1.5)} font-size={fs * 0.75} class="lab">Tub</text>
				<text x={DX(face + 0.6)} y={Yd(w.y0 + 0.1)} font-size={fs * 0.7} class="lab">{ft(input.gap)} caulked</text>
			{/if}
			{#if edge && !w.f.approx}
				{@const a = Math.max(edge.h0, d.mid - DHin / 2)}
				{@const b = Math.min(edge.h1, d.mid + DHin / 2)}
				{@const xx = DX(face + 0.45)}
				<line x1={xx} x2={xx} y1={Yd(a)} y2={Yd(b)} class="dim" stroke-width="1.2" />
				{#if edge.h0 >= a}<line x1={xx - 6} x2={xx + 6} y1={Yd(edge.h0)} y2={Yd(edge.h0)} class="dim" stroke-width="1.2" />{/if}
				{#if edge.h1 <= b}<line x1={xx - 6} x2={xx + 6} y1={Yd(edge.h1)} y2={Yd(edge.h1)} class="dim" stroke-width="1.2" />{/if}
				<text x={xx + 8} y={(Yd(a) + Yd(b)) / 2 + fs * 0.3} font-size={fs * 0.8} class="dt" class:bad={edge.thin}>{ft(edge.h1 - edge.h0)} {edge.cut ? 'cut' : 'full'}</text>
			{/if}
		{/each}
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: var(--drawing-h, 520px);
	}
	.sub {
		fill: var(--plate);
		stroke: var(--wood-edge);
		stroke-width: 1;
	}
	.stud {
		stroke: var(--muted);
	}
	.hl {
		stroke: var(--border);
	}
	.dry {
		fill: var(--surface);
		stroke: var(--muted);
	}
	.backer {
		fill: var(--concrete-side);
		stroke: var(--muted);
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
	.cut {
		fill-opacity: 0.6;
	}
	.thin {
		fill: var(--danger);
		fill-opacity: 0.6;
		stroke: var(--danger);
	}
	.tub {
		fill: var(--surface-2);
		stroke: var(--muted);
	}
	.caulk {
		fill: var(--surface);
	}
	.niche {
		fill: var(--surface-2);
		stroke: var(--muted);
	}
	.win {
		fill: var(--opening);
		stroke: var(--opening-edge);
	}
	.glass {
		stroke: var(--opening-edge);
	}
	.door {
		fill: var(--bg);
		stroke: var(--muted);
	}
	.trimp {
		fill: var(--muted);
		stroke: var(--muted);
	}
	.frame {
		fill: none;
		stroke: var(--border);
	}
	.lab,
	.dt,
	.dtitle {
		font-family: var(--font-num);
	}
	.lab {
		fill: var(--text);
	}
	.dtitle {
		font-weight: 700;
		fill: var(--muted);
	}
	.dt {
		font-weight: 600;
		fill: var(--text);
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
</style>
