<script lang="ts">
	// The stair cut down its length, to scale: the rough floors with the
	// finish floor still to go on, stringers, treads and risers, landings,
	// the upper floor with its opening, and the headroom line. Dimensioned:
	// finished rise, riser and tread, total run, opening.
	import { formatFtIn } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import { STRINGER_DEPTH, type StairInput, type StairResult } from '$lib/takeoff/stairs';

	let { input, r }: { input: StairInput; r: StairResult } = $props();
	const ft = (v: number) => formatFtIn(v, prefs.precision);

	const D = $derived(STRINGER_DEPTH[input.stringer]);
	const fb = $derived(Math.max(0, input.finishBottom));
	const ftp = $derived(Math.max(0, input.finishTop));
	const rise = $derived(Math.max(1, input.rise));
	const tt = $derived(Math.max(0, input.treadThk));
	const rt = $derived(Math.max(0, input.riserThk));
	const nose = $derived(Math.max(0, input.nosing));
	const fd = $derived(Math.max(1, input.floorDepth));
	const slab = 6;
	const top = $derived(rise + ftp);

	// Drawing extents: a floor's worth past each end.
	const before = $derived(Math.max(30, r.run * 0.12));
	const after = $derived(Math.max(36, r.run * 0.15));
	const big = $derived(Math.max(r.run + before + after, top + fd + slab));
	const fs = $derived(Math.max(4, big * 0.028));
	const sw = $derived(big / 500);
	const off = $derived(fs * 1.9);

	// SVG y runs down: flip elevations.
	const Y = (e: number) => -e;
	const left = $derived(-before);
	const right = $derived(r.run + after);

	/** One flight's stringer: a plumb and a level cut at the seat, the
	 *  notches, a plumb cut at the top; the bottom edge parallel. */
	function stringer(fi: number): string {
		const f = r.flights[fi];
		if (f.risers < 2) return '';
		const T = Math.max(1, input.tread);
		const R = r.riser;
		const s = R / T;
		const c1 = f.seat + f.firstRise;
		const drop = Math.max(0.5, r.throat) / Math.cos(Math.atan(s));
		const bottom = (x: number) => c1 + (x - (f.x0 + T)) * s - drop;
		const pts: [number, number][] = [[f.x0, f.seat], [f.x0, c1]];
		let c = c1;
		let x = f.x0;
		for (let k = 1; k < f.risers; k++) {
			x += T;
			pts.push([x, c]);
			c += R;
			pts.push([x, c]);
		}
		const support = fi === r.flights.length - 1 ? rise : f.y1 - tt;
		pts[pts.length - 1][1] = Math.min(c, support);
		pts.push([x, Math.min(bottom(x), support - 1)]);
		pts.push([Math.max(f.x0, f.x0 + T + (f.seat + drop - c1) / s), f.seat]);
		return pts.map(([px, py]) => `${px.toFixed(2)},${Y(py).toFixed(2)}`).join(' ');
	}

	/** The nosing line (dashed) and the headroom line above it. */
	const nosingLine = $derived.by(() => {
		const pts: [number, number][] = [];
		for (const st of r.steps) {
			if (st.kind === 'top') {
				pts.push([st.x0 - nose, st.y]);
				break;
			}
			pts.push([st.x0 - nose, st.y]);
			if (st.kind === 'landing') pts.push([st.x1 - nose, st.y]);
		}
		return pts;
	});
	const line = (pts: [number, number][], dy = 0) => pts.map(([px, py]) => `${px.toFixed(2)},${Y(py + dy).toFixed(2)}`).join(' ');
</script>

{#snippet tick(x: number, y: number)}
	<line x1={x - fs * 0.3} y1={y + fs * 0.3} x2={x + fs * 0.3} y2={y - fs * 0.3} class="dl" stroke-width={sw * 2} />
{/snippet}

{#snippet hdim(x0: number, x1: number, y: number, label: string, below = false)}
	<line x1={x0} x2={x1} y1={y} y2={y} class="dl" stroke-width={sw} />
	{@render tick(x0, y)}{@render tick(x1, y)}
	<text x={(x0 + x1) / 2} y={below ? y + fs * 1.15 : y - fs * 0.45} font-size={fs} class="dt" text-anchor="middle">{label}</text>
{/snippet}

{#snippet vdim(x: number, y0: number, y1: number, label: string, side = 1)}
	<line x1={x} x2={x} y1={y0} y2={y1} class="dl" stroke-width={sw} />
	{@render tick(x, y0)}{@render tick(x, y1)}
	<text x={x + side * fs * 0.55} y={(y0 + y1) / 2} font-size={fs} class="dt" text-anchor="middle" transform="rotate({side * 90} {x + side * fs * 0.55} {(y0 + y1) / 2})">{label}</text>
{/snippet}

<svg viewBox="{left - off * 3} {Y(top + fs * 3.2)} {right - left + off * 5.4} {top + slab + fs * 7}" role="img" aria-label="Stair section">
	<!-- lower floor: slab or subfloor, finish on top -->
	<rect x={left} y={Y(0)} width={right - left} height={slab} class="rough" stroke-width={sw} />
	{#if fb > 0}<rect x={left} y={Y(fb)} width={right - left} height={fb} class="finish" stroke-width={sw} />{/if}

	<!-- upper floor: framing behind the opening and past the top -->
	{#if r.openingAt > left}
		<rect x={left} y={Y(rise)} width={Math.max(0, r.openingAt - left)} height={fd} class="rough" stroke-width={sw} />
		{#if ftp > 0}<rect x={left} y={Y(top)} width={Math.max(0, r.openingAt - left)} height={ftp} class="finish" stroke-width={sw} />{/if}
	{/if}
	<rect x={r.run} y={Y(rise)} width={right - r.run} height={fd} class="rough" stroke-width={sw} />
	{#if ftp > 0}<rect x={r.run} y={Y(top)} width={right - r.run} height={ftp} class="finish" stroke-width={sw} />{/if}

	<!-- landings: platform framing on posts -->
	{#each r.steps.filter((s) => s.kind === 'landing') as l (l.x0)}
		<rect x={l.x0} y={Y(l.y - tt)} width={l.x1 - l.x0} height={Math.min(D, l.y - tt - fb)} class="frame" stroke-width={sw} />
		<rect x={l.x0 - nose} y={Y(l.y)} width={l.x1 - l.x0 + nose} height={tt} class="tread" stroke-width={sw} />
		{#each [l.x0 + 1.75, l.x1 - 1.75] as px (px)}
			<rect x={px - 1.75} y={Y(l.y - tt - D)} width="3.5" height={Math.max(0, l.y - tt - D - fb)} class="frame" stroke-width={sw} />
		{/each}
	{/each}

	<!-- stringers -->
	{#each r.flights as _, i (i)}
		<polygon points={stringer(i)} class="stringer" stroke-width={sw} />
	{/each}

	<!-- risers and treads -->
	{#each r.steps as s, i (i)}
		<rect x={s.x0 - rt} y={Y(s.y - (s.kind === 'tread' ? tt : s.kind === 'top' ? ftp : tt))} width={rt} height={Math.max(0, r.riserBoard)} class="riser" stroke-width={sw} />
		{#if s.kind === 'tread'}
			<rect x={s.x0 - rt - nose} y={Y(s.y)} width={s.x1 - s.x0 + rt + nose} height={tt} class="tread" stroke-width={sw} />
		{/if}
	{/each}

	<!-- nosing line and the headroom it needs -->
	<polyline points={line(nosingLine)} class="nl" stroke-width={sw} stroke-dasharray="{fs * 0.5} {fs * 0.35}" fill="none" />
	<polyline points={line(nosingLine, r.limits.headroom)} class="hr" stroke-width={sw * 1.4} stroke-dasharray="{fs * 0.8} {fs * 0.4}" fill="none" />
	<text x={nosingLine[0][0] + fs * 0.4} y={Y(nosingLine[0][1] + r.limits.headroom) - fs * 0.5} font-size={fs * 0.85} class="hrt">Headroom {ft(r.limits.headroom)}</text>

	<!-- dimensions: finished rise at the left, run below, opening above -->
	{@render vdim(left - off, Y(fb), Y(top), `${ft(r.finishedRise)} finished`, -1)}
	{@render vdim(left - off * 2, Y(0), Y(rise), `${ft(rise)} rough`, -1)}
	{@render hdim(0, r.run, Y(0) + slab + off * 0.9, `${ft(r.run)} run`, true)}
	{#if r.opening > 0}
		{@render hdim(r.openingAt, r.run, Y(top) - off * 0.8, `${ft(r.opening)} opening`)}
	{/if}
	{#if r.steps.length > 1}
		{@const s1 = r.steps[0]}
		{@render vdim(-rt - nose - fs * 0.9, Y(fb), Y(s1.y), ft(r.riser), -1)}
	{/if}
	<text x={right + off * 0.3} y={Y(top) + fs * 0.4} font-size={fs * 0.8} class="lbl">FF {ft(ftp)}</text>
	<text x={right + off * 0.3} y={Y(fb) + fs * 0.4} font-size={fs * 0.8} class="lbl">FF {ft(fb)}</text>
</svg>

<style>
	svg {
		width: 100%;
		display: block;
		max-height: 340px;
	}
	.rough {
		fill: var(--concrete-top);
		stroke: var(--concrete-side);
	}
	.finish {
		fill: var(--opening);
		stroke: var(--opening-edge);
	}
	.stringer {
		fill: var(--wood);
		stroke: var(--wood-edge);
	}
	.frame {
		fill: var(--wood-king);
		stroke: var(--wood-edge);
	}
	.tread {
		fill: var(--wood-header);
		stroke: var(--wood-edge);
	}
	.riser {
		fill: var(--plate);
		stroke: var(--wood-edge);
	}
	.nl {
		stroke: var(--muted);
	}
	.hr {
		stroke: var(--warn-text);
	}
	.hrt {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--warn-text);
	}
	.dl {
		stroke: var(--primary-text);
	}
	.dt {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--primary-text);
	}
	.lbl {
		font-family: var(--font-num);
		font-weight: 600;
		fill: var(--muted);
	}
</style>
