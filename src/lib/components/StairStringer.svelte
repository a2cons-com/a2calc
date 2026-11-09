<script lang="ts">
	// One flight's stringer as it is laid out and cut, standing in place:
	// the seat on the floor (or landing framing), the notches, the plumb cut
	// at the top against the upper subfloor (or the landing). Dimensioned
	// with the numbers of the stringer layout: first rise, a typical rise
	// and tread cut, the top, what's left under the notches, the length.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import { STRINGER_DEPTH, type StairInput, type StairResult } from '$lib/takeoff/stairs';

	let { input, r, flight = 0 }: { input: StairInput; r: StairResult; flight?: number } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const fi = $derived(Math.min(flight, r.flights.length - 1));
	const f = $derived(r.flights[fi]);
	const last = $derived(fi === r.flights.length - 1);
	const T = $derived(Math.max(1, input.tread));
	const R = $derived(r.riser);
	const D = $derived(STRINGER_DEPTH[input.stringer]);
	const k = $derived(Math.max(2, f.risers));
	const c1 = $derived(f.firstRise);
	/** From the last tread cut up to what the stringer hangs on. */
	const topR = $derived(last ? r.topDrop : R);
	const xTop = $derived((k - 1) * T);
	const cutTop = $derived(c1 + (k - 2) * R);
	const H = $derived(cutTop + topR);
	const s = $derived(R / T);
	const ang = $derived(Math.atan(s));
	const drop = $derived(Math.max(0.5, r.throat) / Math.cos(ang));
	const bottom = (x: number) => c1 + (x - T) * s - drop;
	const toe = $derived(Math.max(0, T + (drop - c1) / s));
	const yb = $derived(Math.min(bottom(xTop), H - 1));

	const pts = $derived.by(() => {
		const p: [number, number][] = [[0, 0], [0, c1]];
		let c = c1;
		for (let j = 1; j < k; j++) {
			p.push([j * T, c]);
			c += R;
			if (j < k - 1) p.push([j * T, c]);
		}
		p.push([xTop, H], [xTop, yb], [toe, 0]);
		return p;
	});

	const big = $derived(Math.max(xTop, H, 24));
	const fs = $derived(Math.max(1.6, big * 0.042));
	const sw = $derived(big / 450);
	const off = $derived(fs * 1.6);
	const Y = (e: number) => -e;
	const P = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(2)},${Y(y).toFixed(2)}`).join(' ');
	const deg = $derived((-ang * 180) / Math.PI);

	// Throat: square off the slope from an inner notch corner, to the bottom edge.
	// (past the first notches, where the riser and tread are dimensioned)
	const mj = $derived(k >= 4 ? Math.min(k - 1, Math.max(3, Math.floor(k / 2) + 1)) : Math.max(1, Math.floor(k / 2)));
	const ic = $derived<[number, number]>([mj * T, c1 + (mj - 1) * R]);
	const nrm = $derived<[number, number]>([Math.sin(ang), -Math.cos(ang)]);
	const th = $derived(Math.max(0.5, r.throat));
	const ib = $derived<[number, number]>([ic[0] + nrm[0] * th, ic[1] + nrm[1] * th]);
	// Notch depth: from the outer corner of that notch, square to the corners' line.
	const oc = $derived<[number, number]>([(mj - 1) * T, c1 + (mj - 1) * R]);
	const on = $derived<[number, number]>([oc[0] + nrm[0] * r.notch, oc[1] + nrm[1] * r.notch]);
	// Length, parallel to the bottom edge and below it.
	const lo = $derived(off * 2.2);
	const la = $derived<[number, number]>([toe + nrm[0] * lo, nrm[1] * lo]);
	const lb = $derived<[number, number]>([xTop + nrm[0] * lo, yb + nrm[1] * lo]);
	const tl = $derived<[number, number]>([ib[0] + nrm[0] * fs * 0.4, ib[1] + nrm[1] * fs * 0.4]);

	// What it stands on and hangs from, with their heights above the rough
	// floor at the bottom of the stair: landings are critical dimensions.
	const tt = $derived(Math.max(0, input.treadThk));
	const above = $derived(last ? 'Upper subfloor' : `Landing ${fi + 1} framing +${ft(f.y1 - tt)}`);
	// And the finished references: the floor with its finish on, or the
	// landing with its tread on. Measured from these, every rise is the same.
	const fb = $derived(Math.max(0, input.finishBottom));
	const ftp = $derived(Math.max(0, input.finishTop));
	const ffB = $derived(fi === 0 ? fb : tt);
	const ffT = $derived(H + (last ? ftp : tt));
	const belowS = $derived(fi === 0 ? 'Rough floor' : 'Landing framing');
	const belowFS = $derived(fi === 0 ? `Finished · ${ft(fb)}` : 'Landing finished');
	const aboveF = $derived(last ? `Finished floor · ${ft(ftp)} finish` : `Landing ${fi + 1} finished`);
	/** Where the floor labels end, left of the dimensions. */
	const xl = $derived(-off - fs * 5.6);
	const vb = $derived.by(() => {
		const x0 = xl - fs * 8;
		const x1 = xTop + off + fs * 6.2;
		const top = Math.max(H, ffT) + fs * 2.4;
		const low = Math.min(0, la[1], lb[1]) - fs * 2.6;
		return { x: x0, y: Y(top), w: x1 - x0, h: top - low };
	});
</script>

{#snippet tick(x: number, y: number)}
	<line x1={x - fs * 0.25} y1={y + fs * 0.25} x2={x + fs * 0.25} y2={y - fs * 0.25} class="dl" stroke-width={sw * 2} />
{/snippet}

{#snippet vdim(x: number, e0: number, e1: number, label: string, side = -1)}
	<line x1={x} x2={x} y1={Y(e0)} y2={Y(e1)} class="dl" stroke-width={sw} />
	{@render tick(x, Y(e0))}{@render tick(x, Y(e1))}
	{@const tx = x + (side < 0 ? -fs * 0.5 : fs * 1.2)}
	<text x={tx} y={Y((e0 + e1) / 2)} font-size={fs} class="dt" text-anchor="middle" transform="rotate(-90 {tx} {Y((e0 + e1) / 2)})">{label}</text>
{/snippet}

<!-- A rise measured two ways: a number on the dimension and, above it,
     what it's measured from ("cut" on the board, or "finished"). -->
{#snippet rdim(x: number, e0: number, e1: number, value: string, tag: string, fin: boolean, side = -1)}
	<line x1={x} x2={x} y1={Y(e0)} y2={Y(e1)} class={fin ? 'fl' : 'cl'} stroke-width={sw} />
	{@render tick(x, Y(e0))}{@render tick(x, Y(e1))}
	{@const tx = x + (side < 0 ? -fs * 0.5 : fs * 1.2)}
	<text x={tx} y={Y((e0 + e1) / 2)} font-size={fs} class={fin ? 'ft' : 'ct'} text-anchor="middle" transform="rotate(-90 {tx} {Y((e0 + e1) / 2)})">{value}</text>
	<text x={x} y={Y(Math.max(e0, e1)) - fs * 0.5} font-size={fs * 0.7} class={fin ? 'ft' : 'ct'} text-anchor="middle">{tag}</text>
{/snippet}

{#snippet sdim(a: [number, number], b: [number, number], label: string, cls = 'dt')}
	<line x1={a[0]} y1={Y(a[1])} x2={b[0]} y2={Y(b[1])} class="dl" stroke-width={sw} />
	{@render tick(a[0], Y(a[1]))}{@render tick(b[0], Y(b[1]))}
	<text x={(a[0] + b[0]) / 2} y={Y((a[1] + b[1]) / 2)} dy={fs * 1.15} font-size={fs} class={cls} text-anchor="middle" transform="rotate({deg} {(a[0] + b[0]) / 2} {Y((a[1] + b[1]) / 2)})">{label}</text>
{/snippet}

{#if f.risers > 1}
	<svg viewBox="{vb.x} {vb.y} {vb.w} {vb.h}" role="img" aria-label="Stringer layout">
		<!-- what it sits on and hangs from -->
		<line x1={xl - fs * 8} x2={toe + fs * 3} y1={Y(0)} y2={Y(0)} class="ref" stroke-width={sw * 1.5} />
		<text x={xl} y={Y(0) + fs * 1.0} font-size={fs * 0.75} class="lbl" text-anchor="end">{belowS}</text>
		{#if ffB > 0}
			<line x1={xl - fs * 8} x2={toe + fs * 3} y1={Y(ffB)} y2={Y(ffB)} class="fin" stroke-width={sw * 1.5} stroke-dasharray="{fs * 0.5} {fs * 0.3}" />
		{/if}
		<text x={xl} y={Y(ffB) - fs * 0.4} font-size={fs * 0.75} class="flbl" text-anchor="end">{belowFS}</text>
		<line x1={xTop - fs * 12} x2={xTop + off + fs * 5} y1={Y(H)} y2={Y(H)} class="ref" stroke-width={sw * 1.5} />
		<text x={xTop - fs * 0.4} y={Y(H) + fs * 1.0} font-size={fs * 0.75} class="lbl" text-anchor="end">{above}</text>
		{#if ffT > H}
			<line x1={xTop - fs * 12} x2={xTop + off + fs * 5} y1={Y(ffT)} y2={Y(ffT)} class="fin" stroke-width={sw * 1.5} stroke-dasharray="{fs * 0.5} {fs * 0.3}" />
		{/if}
		<text x={xTop - fs * 0.4} y={Y(ffT) - fs * 0.4} font-size={fs * 0.75} class="flbl" text-anchor="end">{aboveF}</text>
		<!-- the treads, dashed, as they go on -->
		{#each Array.from({ length: k - 1 }, (_, j) => j) as j (j)}
			<rect x={j * T - Math.max(0, input.nosing)} y={Y(c1 + j * R + tt)} width={T + Math.max(0, input.nosing)} height={tt} class="gt" stroke-width={sw} stroke-dasharray="{fs * 0.3} {fs * 0.2}" />
		{/each}

		<polygon points={P(pts)} class="stringer" stroke-width={sw * 1.4} />
		<!-- the line of the inner notch corners -->
		<line x1={T} y1={Y(c1)} x2={xTop} y2={Y(c1 + (xTop - T) * s)} class="ln" stroke-width={sw} stroke-dasharray="{fs * 0.4} {fs * 0.3}" />

		<!-- first rise, at the seat -->
		{@render rdim(-off, 0, c1, ft(c1), 'cut', false)}
		{@render rdim(-off - fs * 4, ffB, c1 + tt, ft(c1 + tt - ffB), 'finished', true)}
		<!-- a typical riser and tread cut -->
		{@render vdim(T - fs * 0.6, c1, c1 + R, ft(R))}
		{#if k > 2}
			{@const ty = c1 + R}
			<line x1={T} x2={2 * T} y1={Y(ty) - fs * 0.7} y2={Y(ty) - fs * 0.7} class="dl" stroke-width={sw} />
			{@render tick(T, Y(ty) - fs * 0.7)}{@render tick(2 * T, Y(ty) - fs * 0.7)}
			<text x={1.5 * T} y={Y(ty) - fs * 1.05} font-size={fs} class="dt" text-anchor="middle">{ft(T)}</text>
		{/if}
		<!-- the top: last tread cut to what it hangs on -->
		{@render rdim(xTop + off, cutTop, H, ft(topR), 'cut', false, 1)}
		{@render rdim(xTop + off + fs * 4, cutTop + tt, ffT, ft(ffT - cutTop - tt), 'finished', true, 1)}
		<!-- notch depth and what's left under it -->
		<line x1={oc[0]} y1={Y(oc[1])} x2={on[0]} y2={Y(on[1])} class="dl" stroke-width={sw} />
		{@render tick(oc[0], Y(oc[1]))}{@render tick(on[0], Y(on[1]))}
		<text x={oc[0] + fs * 0.3} y={Y(oc[1]) - fs * 0.4} font-size={fs * 0.8} class="dt">{ft(r.notch)} deep</text>
		<line x1={ic[0]} y1={Y(ic[1])} x2={ib[0]} y2={Y(ib[1])} class="dl" stroke-width={sw} />
		{@render tick(ic[0], Y(ic[1]))}{@render tick(ib[0], Y(ib[1]))}
		<text x={tl[0]} y={Y(tl[1])} dy={fs * 0.35} font-size={fs * 0.8} class="dt" transform="rotate({deg} {tl[0]} {Y(tl[1])})">{ft(r.throat)} left under notches</text>
		<!-- length along the bottom edge -->
		{@render sdim(la, lb, `${ft(f.length)} · ${f.stock / 12}′ ${input.stringer}`)}
	</svg>
	<p class="cap">
		Cut on the stringer: first {ft(c1)}, then {ft(R)}, top {ft(topR)}. Finished, floor to tread to floor: all {ft(R)}.<br />
		The first cut is the riser, less the tread{fi === 0 ? ', plus the floor finish still to go on' : ''}.
	</p>
{/if}

<style>
	svg {
		width: 100%;
		display: block;
		max-height: 320px;
	}
	.stringer {
		fill: var(--wood);
		stroke: var(--wood-edge);
	}
	.ref {
		stroke: var(--concrete-side);
	}
	.ln {
		stroke: var(--wood-edge);
	}
	.nd {
		stroke: var(--wood-edge);
	}
	.cl {
		stroke: var(--text);
	}
	.ct {
		font-family: var(--font-num);
		font-weight: 700;
		fill: var(--text);
	}
	.fl {
		stroke: var(--primary-text);
	}
	.ft {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--primary-text);
	}
	.fin {
		stroke: var(--primary-text);
	}
	.flbl {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--primary-text);
	}
	.gt {
		fill: none;
		stroke: var(--wood-edge);
	}
	.lbl {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
	.dl {
		stroke: var(--primary-text);
	}
	.dt {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--primary-text);
	}
	.cap {
		margin: 6px 4px 0;
		font-size: 0.8rem;
		color: var(--muted);
		text-align: center;
	}
</style>
