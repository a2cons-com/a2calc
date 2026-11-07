<script lang="ts" module>
	import type { CalcState } from '$lib/calc/calculator';

	export interface Pick {
		/** What the field holds, shown when nothing has been typed. */
		hint: string;
		/** The value the editor opened with (s.done), labelled as such. */
		seed: CalcState['done'];
		done: () => void;
		cancel: () => void;
	}
</script>

<script lang="ts">
	// The calculator: display, memory bar, keypad and its sheets (tape,
	// units, memory, precision). The calculator page shows it on the shared
	// state; every dimension field opens it too (ValueEditor, "pick" mode),
	// where the = key turns into Done once there is a value to use.
	import type { Snippet } from 'svelte';
	import * as C from '$lib/calc/calculator';
	import { formatAs, formatsFor, frac, nextFormat, PRECISIONS, UNITS, UNITS_BY_DIM, DIM_NAME, type LengthFormat, type UnitId, type Dim } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import { openParens } from '$lib/calc/expression';
	import Keypad from '$lib/components/Keypad.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { keyAction } from '$lib/keyboard';
	import type { EntryKey } from '$lib/calc/entry';
	import { copyText, plainText, tap } from '$lib/native';
	import { parseText } from '$lib/calc/entry';

	let {
		s = $bindable(),
		active = true,
		main = false,
		pick = null,
		lead,
		trail
	}: {
		s: C.CalcState;
		/** Takes the physical keyboard (no other sheet or editor on top). */
		active?: boolean;
		/** The app's own calculator: serves the Mac app's Edit menu. */
		main?: boolean;
		pick?: Pick | null;
		lead: Snippet;
		trail?: Snippet;
	} = $props();

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

	const set = (next: C.CalcState) => (s = next);
	/** Pick mode: a value to use (an answer, or a single number typed). */
	const ready = $derived(!!pick && (!!s.done || (s.tokens.length === 1 && (s.tokens[0].kind === 'value' || (s.tokens[0].kind === 'entry' && s.tokens[0].entry.raw !== '')))));
	function equalsKey() {
		if (pick && ready) pick.done();
		else set(C.equals(s));
	}

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

	// Long-press on ′ or ″: the number as that unit, squared or cubed.
	let powerKey = $state<'ft' | 'in' | null>(null);
	let powerOpen = $state(false);
	$effect(() => {
		if (powerKey) powerOpen = true;
	});
	$effect(() => {
		if (!powerOpen) powerKey = null;
	});
	/** After an answer, ′ and ″ change how it is shown: ′ feet-based
	 *  (ft-in, decimal ft; sq ft, sq yd; cu ft, cu yd), ″ inch-based
	 *  (fractional, decimal inches; sq in; cu in). A plain number becomes
	 *  feet or inches. */
	function resultKey(k: 'ft' | 'in') {
		if (!s.done) return;
		const d = s.done.d;
		if (d === 0) {
			set(C.unit(s, k));
			prefs.fmt[1] = k === 'ft' ? 'ftin' : 'in';
			return;
		}
		prefs.fmt[d as 1 | 2 | 3] = nextFormat(d as 1 | 2 | 3, k, fmt);
	}
	function pickFormat(f: LengthFormat) {
		if (s.done && s.done.d > 0) prefs.fmt[s.done.d as 1 | 2 | 3] = f;
		powerOpen = false;
	}
	function pickPlainUnit(u: UnitId) {
		set(C.unit(s, u));
		powerOpen = false;
	}
	function onKey(k: EntryKey) {
		if (s.done && (k === 'ft' || k === 'in')) resultKey(k);
		else set(C.key(s, k));
	}

	function pickPower(p: 1 | 2 | 3) {
		if (powerKey) set(C.power(s, powerKey, p));
		powerOpen = false;
	}
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

	// Tap the answer (or Cmd/Ctrl+C) to copy it as plain text.
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;
	async function copyAnswer() {
		const text = shown ? shown.text : expr;
		if (!text) return;
		if (await copyText(plainText(text))) {
			tap();
			copied = true;
			if (copiedTimer) clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 1400);
		}
	}

	// Physical keyboard: only while no sheet or field editor is open.
	async function onKeydown(e: KeyboardEvent) {
		if (!active || tapeOpen || unitOpen || precOpen || memOpen || powerOpen) return;
		if (pick && e.key === 'Escape' && !e.metaKey && !e.ctrlKey) {
			e.preventDefault();
			pick.cancel();
			return;
		}
		const a = keyAction(e);
		if (!a) return;
		e.preventDefault();
		switch (a.kind) {
			case 'entry':
				onKey(a.key);
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
				equalsKey();
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
			case 'copy':
				await copyAnswer();
				break;
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

	// The Mac app's Edit menu: Copy gives the answer (or the formula), Paste
	// puts a typed value like 8' 4 1/2" in as the current number.
	$effect(() => {
		if (!main) return;
		const w = window as unknown as { __a2calc?: object };
		w.__a2calc = {
			copyText: () => (shown ? shown.text : expr || null),
			paste: (text: string) => {
				const v = parseText(text);
				if (v) set(C.insert(s, v, den));
				return !!v;
			}
		};
		return () => delete w.__a2calc;
	});

	const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	const dimOf = (d: Dim) => (d === 0 ? '' : DIM_NAME[d]);
</script>

<svelte:window onkeydown={onKeydown} />

<div class="screen" class:landscape>
	<div class="left">
	<header>
		{@render lead()}
		<span class="spacer"></span>
		<button class="pill" onclick={() => (memOpen = true)} aria-label="Memory">M</button>
		<button class="pill" onclick={() => (precOpen = true)} aria-label="Fraction precision">
			<span class="num">{frac(1, den)}″</span>
		</button>
		<button class="icon-btn" onclick={() => (tapeOpen = true)} aria-label="Tape"><Icon name="tape" /></button>
		{@render trail?.()}
	</header>

	<section class="display" aria-live="polite">
		<div class="expr num">{pick && s.done && s.done === pick.seed ? 'Now' : s.done ? (s.tape[0]?.expr ?? '') : ' '}</div>
		<button class="result num" class:done={!!shown} class:formula={!shown} style="font-size:{size}rem" onclick={copyAnswer} disabled={!shown} aria-label={shown ? `Answer ${shown.text}, tap to copy` : undefined}>
			{#if shown?.rounded}<span class="approx" title="Rounded to {frac(1, den)}″">≈</span>{/if}{big}
		</button>
		<div class="meta">
			{#if copied}
				<span class="copied">Copied</span>
			{:else if error}
				<span class="error">{error}</span>
			{:else if pick && (!value || value === pick.seed)}
				<span class="kind">{pick.hint}</span>
			{:else if value}
				<span class="kind">{value.d > 0 ? `${dimOf(value.d)} · ${formatsFor(value.d).find((f) => f.id === fmt)?.label ?? ''} · ` : ''}tap to copy</span>
			{/if}
		</div>
		{#if value && value.d > 0 && landscape}
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
			can={(k) => (!!s.done && (k === 'ft' || k === 'in')) || C.canKey(s, k)}
			{unitEnabled}
			onkey={onKey}
			onback={() => set(C.back(s))}
			onclear={() => set(C.clear(s))}
			onop={(o) => set(C.op(s, o, den, fmt))}
			onparen={(p) => set(C.paren(s, p, den, fmt))}
			canParen={(p) => C.canParen(s, p)}
			onequals={equalsKey}
			equalsLabel={pick && ready ? 'Done' : '='}
			onunit={() => (unitOpen = true)}
			wide={landscape}
			{onfn}
			onlong={(k) => (powerKey = k)}
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

<Sheet bind:open={powerOpen} title={s.done ? 'Show the answer as' : powerKey === 'in' ? 'Inches' : 'Feet'}>
	{#if s.done && s.done.d > 0}
		<div class="fmt-list">
			{#each formatsFor(s.done.d) as f (f.id)}
				<button class="fmt" class:on={fmt === f.id} onclick={() => pickFormat(f.id)}>
					<span>{f.name}</span><span class="num">{formatAs(s.done, f.id, den).text}</span>
				</button>
			{/each}
		</div>
	{:else if s.done}
		<div class="fmt-list">
			{#each ['ft', 'sqft', 'cuft', 'in', 'sqin', 'cuin'] as const as u (u)}
				<button class="fmt" onclick={() => pickPlainUnit(u)}><span>{UNITS[u].name}</span><span class="num">{formatAs(s.done, 'ftin', den).text} {UNITS[u].label}</span></button>
			{/each}
		</div>
	{:else if C.canPower(s)}
		<div class="powers">
			{#each [1, 2, 3] as const as p (p)}
				<button class="power" onclick={() => pickPower(p)}>
					<span class="num pw">{powerKey === 'in' ? 'in' : 'ft'}{p === 2 ? '²' : p === 3 ? '³' : ''}</span>
					<span class="pl">{p === 1 ? (powerKey === 'in' ? 'Inches' : 'Feet') : p === 2 ? 'Square' : 'Cubic'}</span>
				</button>
			{/each}
		</div>
		<p class="fine">Tip: tapping the key again does the same: once {powerKey === 'in' ? 'in' : 'ft'}, twice square, three times cubic.</p>
	{:else}
		<p class="fine">Type a number first, then hold the key to make it {powerKey === 'in' ? 'inches' : 'feet'}, square or cubic.</p>
	{/if}
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
	.spacer {
		flex: 1;
	}
	.display {
		/* Takes what the keys leave; never squeezed below a readable answer. */
		flex: 1 1 auto;
		min-height: min-content;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: stretch;
		text-align: right;
		padding: 8px 6px 10px;
		overflow: hidden;
	}
	/* Scrolling boxes in a flex column may otherwise shrink below their
	   text, which cut the tops off the formula and the answer on short
	   screens (a 640 pt tall phone). */
	.display > * {
		flex-shrink: 0;
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
	button.result {
		display: block;
		width: 100%;
		text-align: right;
		font-family: var(--font-num);
	}
	button.result:disabled {
		opacity: 1;
		cursor: default;
	}
	button.result.done:active {
		opacity: 0.6;
	}
	.copied {
		color: var(--primary-text);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.72rem;
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
	.fmt-list {
		display: flex;
		flex-direction: column;
	}
	.fmt {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		padding: 12px 8px;
		border-radius: 12px;
		font-weight: 600;
		text-align: left;
	}
	.fmt + .fmt {
		border-top: 1px solid var(--border);
	}
	.fmt.on {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.fmt .num {
		font-size: 1.1rem;
	}
	.powers {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-bottom: 12px;
	}
	.power {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 16px 8px;
		border-radius: 16px;
		background: var(--key-unit);
		color: var(--primary-text);
	}
	.pw {
		font-size: 1.6rem;
		font-weight: 650;
	}
	.pl {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
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
