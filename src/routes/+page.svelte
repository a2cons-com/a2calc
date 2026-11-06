<script lang="ts">
	import * as C from '$lib/calc/calculator';
	import { formatAs, formatsFor, frac, PRECISIONS, UNITS, UNITS_BY_DIM, DIM_NAME, type UnitId, type Dim } from '$lib/calc/units';
	import { calc, prefs } from '$lib/stores/app.svelte';
	import { openParens } from '$lib/calc/expression';
	import Keypad from '$lib/components/Keypad.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import AppMark from '$lib/components/AppMark.svelte';
	import MenuButton from '$lib/components/MenuButton.svelte';
	import { keyAction } from '$lib/keyboard';
	import { parseText } from '$lib/calc/entry';
	import { editor } from '$lib/stores/editor.svelte';
	import { nav } from '$lib/stores/nav.svelte';

	const s = $derived(calc.s);
	const den = $derived(prefs.precision);
	// Nothing is worked out while typing: the big line is the formula; the
	// answer replaces it only on '='.
	const value = $derived(s.done);
	const fmt = $derived(value && value.d > 0 ? prefs.fmt[value.d as 1 | 2 | 3] : 'ftin');
	const shown = $derived(value ? formatAs(value, fmt, den) : null);
	const expr = $derived(C.exprText(s));
	const open = $derived(openParens(s.tokens));
	const big = $derived(shown ? shown.text : expr ? expr + (open ? ')'.repeat(open) : '') : '0');
	const size = $derived.by(() => {
		const n = big.length;
		if (shown) return n > 16 ? 1.9 : n > 12 ? 2.4 : n > 9 ? 2.9 : 3.4;
		return n > 34 ? 1.35 : n > 22 ? 1.7 : n > 14 ? 2.1 : n > 9 ? 2.6 : 3.2;
	});
	const error = $derived(s.error);

	const current = $derived.by(() => {
		const last = s.tokens[s.tokens.length - 1];
		return last?.kind === 'entry' ? last.entry : null;
	});
	// Unit keys tag the number just typed, or re-unit an answer.
	const unitEnabled = $derived(!!s.done || (!!current && current.raw !== '' && !/['"]/.test(current.raw)));
	const vars = $derived(s.vars ?? {});
	let tapeOpen = $state(false);
	let unitOpen = $state(false);
	let precOpen = $state(false);

	const set = (next: C.CalcState) => (calc.s = next);

	function pickUnit(u: UnitId) {
		unitOpen = false;
		const d = s.done?.d;
		if (s.done && d) {
			// An answer with a unit: show it in this one, if it's the same kind.
			if (UNITS[u].d === d) prefs.fmt[d as 1 | 2 | 3] = u;
			else set({ ...s, error: `That answer is ${DIM_NAME[d as Dim].toLowerCase() === 'area' ? 'an area' : `a ${DIM_NAME[d as Dim].toLowerCase()}`}` });
			return;
		}
		set(C.unit(s, u));
	}

	// Memory bar: tap a stored letter to use it; tap an empty one to store
	// the answer (or the formula's value); hold one for the memory sheet.
	let memOpen = $state(false);
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;
	function memDown() {
		held = false;
		holdTimer = setTimeout(() => {
			held = true;
			memOpen = true;
		}, 500);
	}
	function memUp() {
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
	}
	function memTap(name: C.VarName) {
		if (held) return;
		if (vars[name]) set(C.useVar(s, name));
		else set(C.storeVar(s, name));
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
	function onfn(f: 'sq' | 'cube' | 'sqrt' | 'neg' | 'pi') {
		set(f === 'pi' ? C.pi(s) : C.fn(s, f, den, fmt));
	}
	const resultText = (line: C.TapeLine) => formatAs(line.result, line.result.d > 0 ? prefs.fmt[line.result.d as 1 | 2 | 3] : 'ftin', den).text;

	// Physical keyboard: only while no sheet or field editor is open.
	let copied = $state(false);
	async function onKeydown(e: KeyboardEvent) {
		if (tapeOpen || unitOpen || precOpen || memOpen || nav.open || editor.req) return;
		const a = keyAction(e);
		if (!a) return;
		e.preventDefault();
		switch (a.kind) {
			case 'entry':
				set(C.key(s, a.key));
				break;
			case 'slash':
				set(C.canKey(s, 'frac') && !s.done ? C.key(s, 'frac') : C.op(s, '÷', den, fmt));
				break;
			case 'op':
				set(C.op(s, a.op, den, fmt));
				break;
			case 'paren':
				set(C.paren(s, a.p, den, fmt));
				break;
			case 'equals':
				set(C.equals(s));
				break;
			case 'back':
				set(C.back(s));
				break;
			case 'clear':
				set(C.clear(s));
				break;
			case 'var':
				if (vars[a.name as C.VarName]) set(C.useVar(s, a.name as C.VarName));
				break;
			case 'copy': {
				const text = shown ? shown.text : big;
				try {
					await navigator.clipboard.writeText(text);
					copied = true;
					setTimeout(() => (copied = false), 1200);
				} catch {
					/* clipboard blocked */
				}
				break;
			}
			case 'paste': {
				try {
					const v = parseText(await navigator.clipboard.readText());
					if (v) set(C.insert(s, v, den));
				} catch {
					/* clipboard blocked */
				}
				break;
			}
		}
	}

	const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	const dimOf = (d: Dim) => (d === 0 ? '' : DIM_NAME[d]);
</script>

<svelte:head><title>A2 Calc</title></svelte:head>
<svelte:window onkeydown={onKeydown} />

<div class="screen" class:landscape>
	<div class="left">
	<header>
		<AppMark size={28} />
		<span class="title">A2 Calc</span>
		<span class="spacer"></span>
		{#if landscape}
			<button class="pill" disabled={!unitEnabled} onclick={() => (unitOpen = true)}>Unit</button>
		{/if}
		<button class="pill" onclick={() => (memOpen = true)} aria-label="Memory">M</button>
		<button class="pill" onclick={() => (precOpen = true)} aria-label="Fraction precision">
			<span class="num">{frac(1, den)}″</span>
		</button>
		<button class="icon-btn" onclick={() => (tapeOpen = true)} aria-label="Tape"><Icon name="tape" /></button>
		<MenuButton />
	</header>

	<section class="display" aria-live="polite">
		<div class="expr num">{s.done ? (s.tape[0]?.expr ?? '') : ' '}</div>
		<div class="result num" class:done={!!shown} class:formula={!shown} style="font-size:{size}rem">
			{#if shown?.rounded}<span class="approx" title="Rounded to {frac(1, den)}″">≈</span>{/if}{big}
		</div>
		<div class="meta">
			{#if copied}
				<span class="kind">Copied</span>
			{:else if error}
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
	<div class="mem" role="group" aria-label="Memory">
		{#each C.VARS as name (name)}
			{@const v = vars[name]}
			<button
				class="mem-key"
				class:set={!!v}
				onpointerdown={memDown}
				onpointerup={memUp}
				onpointerleave={memUp}
				oncontextmenu={(e) => e.preventDefault()}
				onclick={() => memTap(name)}
				aria-label={v ? `Use ${name}` : `Store in ${name}`}
			>
				<span class="mem-name">{name}</span>
				{#if v}<span class="mem-val num">{formatAs(v, v.d > 0 ? prefs.fmt[v.d as 1 | 2 | 3] : 'ftin', den).text}</span>{/if}
			</button>
		{/each}
	</div>
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
			onop={(o) => set(C.op(s, o, den, fmt))}
			onparen={(p) => set(C.paren(s, p, den, fmt))}
			canParen={(p) => C.canParen(s, p)}
			onequals={() => set(C.equals(s))}
			onunit={() => (unitOpen = true)}
			wide={landscape}
			{onfn}
			onquick={pickUnit}
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

<Sheet bind:open={memOpen} title="Memory">
	<p class="fine">Tap a letter on the bar to use it; tap an empty one right after = to store the answer there.</p>
	<ul class="mem-list">
		{#each C.VARS as name (name)}
			{@const v = vars[name]}
			<li>
				<span class="ml-name">{name}</span>
				<span class="ml-val num">{v ? formatAs(v, v.d > 0 ? prefs.fmt[v.d as 1 | 2 | 3] : 'ftin', den).text : 'empty'}</span>
				<button class="btn" onclick={() => { set(C.storeVar(s, name)); }} disabled={!s.done && !expr}>Store {s.done ? 'answer' : 'formula'}</button>
				{#if v}
					<button class="btn" onclick={() => { set(C.useVar(s, name)); memOpen = false; }}>Use</button>
					<button class="btn quiet" onclick={() => set(C.clearVar(s, name))} aria-label="Clear {name}"><Icon name="trash" size={18} /></button>
				{/if}
			</li>
		{/each}
	</ul>
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
		/* Takes what the keys leave; never squeezed below a readable answer. */
		flex: 1 1 auto;
		min-height: 104px;
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
	.result.formula {
		color: var(--text);
		white-space: normal;
		word-break: break-word;
		font-weight: 500;
		max-height: 3.4em;
		overflow-y: auto;
	}
	.mem {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 5px;
		margin: 0 0 8px;
		flex: none;
	}
	.mem-key {
		height: 38px;
		border-radius: 10px;
		border: 1.5px dashed var(--border);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		line-height: 1.05;
		color: var(--faint);
		-webkit-touch-callout: none;
	}
	.mem-key.set {
		border: 0;
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.mem-name {
		font-weight: 700;
		font-size: 0.95rem;
	}
	.mem-val {
		font-size: 0.62rem;
		font-weight: 600;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0 3px;
	}
	.mem-list {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
	}
	.mem-list li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
		border-top: 1px solid var(--border);
	}
	.ml-name {
		font-weight: 700;
		width: 1.4em;
		color: var(--primary-text);
	}
	.ml-val {
		flex: 1;
		font-weight: 600;
	}
	.mem-list .btn {
		padding: 8px 12px;
		font-size: 0.88rem;
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
		/* Up to 520px, shrinking on shorter screens (notch, home bar and tab
		   bar all come out of the height) instead of running under the tabs. */
		flex: 0 1 520px;
		min-height: 300px;
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
		flex: 1 1 auto;
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
