<script lang="ts">
	import * as C from '$lib/calc/calculator';
	import { formatAs, formatsFor, frac, PRECISIONS, UNITS, UNITS_BY_DIM, DIM_NAME, type UnitId, type Dim } from '$lib/calc/units';
	import { calc, prefs } from '$lib/stores/app.svelte';
	import Keypad from '$lib/components/Keypad.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';

	const s = $derived(calc.s);
	const den = $derived(prefs.precision);
	const live = $derived(C.live(s));
	const value = $derived(live.value);
	const fmt = $derived(value && value.d > 0 ? prefs.fmt[value.d as 1 | 2 | 3] : 'ftin');
	const shown = $derived(value ? formatAs(value, fmt, den) : { text: '0', rounded: false });
	const expr = $derived(C.exprText(s));
	const error = $derived(s.error ?? (s.done ? null : live.error));
	const typing = $derived(!s.done);
	const size = $derived(shown.text.length > 16 ? 1.9 : shown.text.length > 12 ? 2.4 : shown.text.length > 9 ? 2.9 : 3.4);

	const current = $derived.by(() => {
		const last = s.tokens[s.tokens.length - 1];
		return last?.kind === 'entry' ? last.entry : null;
	});
	const unitEnabled = $derived(!s.done && !!current && current.raw !== '' && !/['"]/.test(current.raw));

	let tapeOpen = $state(false);
	let unitOpen = $state(false);
	let precOpen = $state(false);

	const set = (next: C.CalcState) => (calc.s = next);

	function pickUnit(u: UnitId) {
		set(C.unit(s, u));
		unitOpen = false;
	}

	function reuse(line: C.TapeLine) {
		set(C.insert(s, line.result, den));
		tapeOpen = false;
	}

	/** A phone on its side: display and tape left, keypad right. */
	let landscape = $state(false);
	$effect(() => {
		const mq = matchMedia('(orientation: landscape) and (max-height: 540px)');
		const update = () => (landscape = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});
	function onfn(f: 'sq' | 'sqrt' | 'neg' | 'pi') {
		set(f === 'pi' ? C.pi(s) : C.fn(s, f, den));
	}
	const resultText = (line: C.TapeLine) => formatAs(line.result, line.result.d > 0 ? prefs.fmt[line.result.d as 1 | 2 | 3] : 'ftin', den).text;

	const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	const dimOf = (d: Dim) => (d === 0 ? '' : DIM_NAME[d]);
</script>

<svelte:head><title>A2 Calc</title></svelte:head>

<div class="screen" class:landscape>
	<div class="left">
	<header>
		<Logo size={22} />
		<span class="title">Calc</span>
		<span class="spacer"></span>
		<button class="pill" onclick={() => (precOpen = true)} aria-label="Fraction precision">
			<span class="num">{frac(1, den)}″</span>
		</button>
		<button class="icon-btn" onclick={() => (tapeOpen = true)} aria-label="Tape"><Icon name="tape" /></button>
		<a class="icon-btn" href="/about" aria-label="About"><Icon name="info" /></a>
	</header>

	<section class="display" aria-live="polite">
		<div class="expr num" class:typing>{expr || ' '}</div>
		<div class="result num" class:done={!typing} style="font-size:{size}rem">
			{#if shown.rounded}<span class="approx" title="Rounded to {frac(1, den)}″">≈</span>{/if}{shown.text}
		</div>
		<div class="meta">
			{#if error}
				<span class="error">{error}</span>
			{:else if value && value.d > 0}
				<span class="kind">{dimOf(value.d)}</span>
			{/if}
		</div>
		{#if value && value.d > 0}
			<div class="formats">
				{#each formatsFor(value.d) as f (f.id)}
					<button class="chip" class:on={fmt === f.id} onclick={() => (prefs.fmt[value.d as 1 | 2 | 3] = f.id)}>{f.label}</button>
				{/each}
			</div>
		{:else}
			<div class="formats placeholder"></div>
		{/if}
	</section>
	{#if landscape}
		<ul class="mini-tape">
			{#each s.tape.slice(0, 30) as line (line.at)}
				<li>
					<button onclick={() => set(C.insert(s, line.result, den))}>
						<span class="num m-expr">{line.expr}</span>
						<span class="num m-res">{resultText(line)}</span>
					</button>
				</li>
			{:else}
				<li class="fine m-empty">Answers show up here.</li>
			{/each}
		</ul>
	{/if}
	</div>

	<section class="keys">
		<Keypad
			mode="calc"
			can={(k) => C.canKey(s, k)}
			{unitEnabled}
			onkey={(k) => set(C.key(s, k))}
			onback={() => set(C.back(s))}
			onclear={() => set(C.clear(s))}
			onop={(o) => set(C.op(s, o, den))}
			onequals={() => set(C.equals(s))}
			onunit={() => (unitOpen = true)}
			wide={landscape}
			{onfn}
		/>
	</section>
</div>

<Sheet bind:open={tapeOpen} title="Tape">
	{#snippet actions()}
		{#if s.tape.length}
			<button class="btn quiet" onclick={() => set({ ...s, tape: [] })}>Clear</button>
		{/if}
	{/snippet}
	{#if s.tape.length === 0}
		<p class="fine empty">Every answer lands here. Tap one to use it again.</p>
	{:else}
		<ul class="tape">
			{#each s.tape as line (line.at)}
				<li>
					<button onclick={() => reuse(line)}>
						<span class="t-expr num">{line.expr}</span>
						<span class="t-res num">= {resultText(line)}</span>
						<span class="t-time">{time(line.at)}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Sheet>

<Sheet bind:open={unitOpen} title="Unit for this number">
	<p class="fine">For areas, volumes and metric typed in: 120 then sq ft. Feet and inches have their own keys.</p>
	{#each [1, 2, 3] as const as d (d)}
		<div class="section-title">{DIM_NAME[d]}</div>
		<div class="unit-grid">
			{#each UNITS_BY_DIM[d] as u (u)}
				<button class="pill" onclick={() => pickUnit(u)}>{UNITS[u].label}</button>
			{/each}
		</div>
	{/each}
</Sheet>

<Sheet bind:open={precOpen} title="Fraction precision">
	<p class="fine">Results round to the nearest fraction; a ≈ shows when they do.</p>
	<div class="seg prec">
		{#each PRECISIONS as p (p)}
			<button class="num" class:on={den === p} onclick={() => { prefs.precision = p; precOpen = false; }}>{frac(1, p)}</button>
		{/each}
	</div>
</Sheet>

<style>
	.screen {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: calc(env(safe-area-inset-top) + 6px) 14px calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 12px);
		max-width: 560px;
		margin: 0 auto;
	}
	header {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 48px;
		flex: none;
	}
	.title {
		font-weight: 700;
		font-size: 1.15rem;
		margin-left: 2px;
	}
	.spacer {
		flex: 1;
	}
	.display {
		flex: 1 1 auto;
		min-height: 170px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: stretch;
		text-align: right;
		padding: 8px 6px 10px;
		overflow: hidden;
	}
	.expr {
		font-size: 1.2rem;
		color: var(--muted);
		line-height: 1.3;
		max-height: 3.9em;
		overflow-y: auto;
		word-break: break-word;
	}
	.expr.typing {
		color: var(--text);
		font-size: 1.45rem;
	}
	.result {
		font-weight: 600;
		line-height: 1.1;
		margin-top: 4px;
		white-space: nowrap;
		overflow-x: auto;
		color: var(--muted);
		letter-spacing: -0.02em;
		transition: color 0.1s;
	}
	.result.done {
		color: var(--text);
	}
	.approx {
		font-size: 0.6em;
		color: var(--faint);
		margin-right: 6px;
		vertical-align: 0.15em;
	}
	.meta {
		min-height: 1.4em;
		font-size: 0.85rem;
		margin-top: 2px;
	}
	.kind {
		color: var(--faint);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.72rem;
	}
	.error {
		color: var(--danger);
		font-weight: 500;
	}
	.formats {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		overflow-x: auto;
		margin-top: 8px;
		min-height: 34px;
		scrollbar-width: none;
	}
	.chip {
		padding: 6px 12px;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--surface-2);
		white-space: nowrap;
	}
	.chip.on {
		background: var(--primary);
		color: var(--primary-ink);
	}
	.keys {
		flex: 0 0 auto;
		height: min(470px, 58dvh);
	}
	.left {
		display: contents;
	}
	.screen.landscape {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
		gap: 18px;
		max-width: none;
		padding: calc(env(safe-area-inset-top) + 4px) max(14px, env(safe-area-inset-right)) calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px) max(14px, env(safe-area-inset-left));
	}
	.landscape .left {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.landscape header {
		height: 40px;
	}
	.landscape .display {
		flex: none;
		min-height: 0;
		padding: 0 4px 6px;
	}
	.landscape .expr {
		max-height: 2.6em;
	}
	.landscape .formats {
		margin-top: 4px;
	}
	.landscape .keys {
		height: auto;
		min-height: 0;
	}
	.mini-tape {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		border-top: 1px solid var(--border);
	}
	.mini-tape button {
		width: 100%;
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 7px 4px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}
	.m-expr {
		color: var(--muted);
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.m-res {
		font-weight: 600;
		white-space: nowrap;
	}
	.m-empty {
		padding: 10px 4px;
	}
	.tape {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tape li + li {
		border-top: 1px solid var(--border);
	}
	.tape button {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 2px 12px;
		text-align: right;
		padding: 12px 4px;
	}
	.t-expr {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.95rem;
	}
	.t-res {
		grid-column: 1 / -1;
		font-size: 1.35rem;
		font-weight: 600;
	}
	.t-time {
		grid-column: 1 / -1;
		font-size: 0.72rem;
		color: var(--faint);
	}
	.empty {
		text-align: center;
		padding: 24px 0;
	}
	.unit-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.unit-grid .pill {
		padding: 10px 16px;
		font-size: 1rem;
	}
	.prec {
		margin: 12px 0 8px;
	}
	.prec button {
		padding: 12px 0;
		font-size: 1.05rem;
	}
</style>
