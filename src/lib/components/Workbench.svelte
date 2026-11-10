<script lang="ts">
	// A takeoff laid out around its drawing, so the drawing stays in sight
	// while the inputs change. On a phone: Small floats the drawing in a
	// corner over the inputs (drag its bar to another corner, drag its
	// corner handle to size it), Large sticks it full width under the page
	// head, or hide it. On a wide window it is a column of its own.
	import { onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';

	let { preview, children, id }: { preview: Snippet; children: Snippet; /** Remembers the size per tool. */ id: string } = $props();

	type Size = 'small' | 'large' | 'hidden';
	type Corner = 'tl' | 'tr' | 'bl' | 'br';
	const key = () => `a2calc:preview:${id}`;
	const FLOAT_KEY = 'a2calc:preview:float';
	let size = $state<Size>('small');
	/** The floating view: where it sits and how big it is (kept for all tools). */
	let corner = $state<Corner>('tl');
	let fw = $state(0);
	let fh = $state(0);
	try {
		const v = browser ? localStorage.getItem(key()) : null;
		if (v === 'small' || v === 'large' || v === 'hidden') size = v;
		const f = browser ? JSON.parse(localStorage.getItem(FLOAT_KEY) ?? 'null') : null;
		if (f && ['tl', 'tr', 'bl', 'br'].includes(f.corner)) corner = f.corner;
		if (f && Number.isFinite(f.w) && Number.isFinite(f.h)) {
			fw = f.w;
			fh = f.h;
		}
	} catch {
		/* private window: the defaults */
	}
	function set(v: Size) {
		size = v;
		try {
			localStorage.setItem(key(), v);
		} catch {
			/* not kept */
		}
	}
	function keepFloat() {
		try {
			localStorage.setItem(FLOAT_KEY, JSON.stringify({ corner, w: fw, h: fh }));
		} catch {
			/* not kept */
		}
	}

	// Stick under the page head, however tall it is (safe areas, wrap);
	// float only on narrow screens.
	let top = $state(0);
	let narrow = $state(false);
	let vw = $state(400);
	let vh = $state(800);
	const clampW = (w: number) => Math.round(Math.max(150, Math.min(vw - 20, w)));
	const clampH = (h: number) => Math.round(Math.max(120, Math.min(vh * 0.7, h)));
	onMount(() => {
		const head = document.querySelector('.page-head') as HTMLElement | null;
		const ro = head ? new ResizeObserver(() => (top = head.offsetHeight)) : null;
		if (head) ro!.observe(head);
		const mq = window.matchMedia('(max-width: 899px)');
		const fit = () => {
			narrow = mq.matches;
			vw = window.innerWidth;
			vh = window.innerHeight;
			fw = clampW(fw || vw * 0.52);
			fh = clampH(fh || 190);
		};
		fit();
		mq.addEventListener('change', fit);
		window.addEventListener('resize', fit);
		return () => {
			ro?.disconnect();
			mq.removeEventListener('change', fit);
			window.removeEventListener('resize', fit);
		};
	});
	const floating = $derived(narrow && size === 'small');

	// Moving: follow the finger, then settle into the nearest corner.
	let drag = $state<{ x: number; y: number; dx: number; dy: number } | null>(null);
	function moveStart(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
	}
	function moveOn(e: PointerEvent) {
		if (drag) drag = { ...drag, dx: e.clientX - drag.x, dy: e.clientY - drag.y };
	}
	function moveEnd(e: PointerEvent) {
		if (!drag) return;
		const box = (e.currentTarget as HTMLElement).closest('.body')!.getBoundingClientRect();
		const cx = box.left + box.width / 2;
		const cy = box.top + box.height / 2;
		corner = `${cy < vh / 2 ? 't' : 'b'}${cx < vw / 2 ? 'l' : 'r'}` as Corner;
		drag = null;
		keepFloat();
	}

	// Sizing: the handle sits on the corner away from the anchored one.
	let grow: { x: number; y: number; w: number; h: number } | null = null;
	function sizeStart(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		grow = { x: e.clientX, y: e.clientY, w: fw, h: fh };
		e.stopPropagation();
	}
	function sizeOn(e: PointerEvent) {
		if (!grow) return;
		const sx = corner.endsWith('l') ? 1 : -1;
		const sy = corner.startsWith('t') ? 1 : -1;
		fw = clampW(grow.w + (e.clientX - grow.x) * sx);
		fh = clampH(grow.h + (e.clientY - grow.y) * sy);
	}
	function sizeEnd() {
		if (!grow) return;
		grow = null;
		keepFloat();
	}
</script>

<div class="bench">
	<div class="pv {size}" class:floating style="top:{top}px; --top:{top}px">
		<div
			class="card body {corner}"
			class:dragging={!!drag}
			style={floating ? `--fw:${fw}px; --fh:${fh}px; --head:${top}px; transform:translate(${drag?.dx ?? 0}px, ${drag?.dy ?? 0}px)` : ''}
		>
			{#if floating}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="grip" onpointerdown={moveStart} onpointermove={moveOn} onpointerup={moveEnd} onpointercancel={moveEnd}>
					<span class="dots" aria-hidden="true"></span>
					<button onclick={() => set('large')} aria-label="Make the drawing large">Large</button>
					<button onclick={() => set('hidden')} aria-label="Hide the drawing">Hide</button>
				</div>
			{/if}
			{@render preview()}
			{#if floating}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="handle" onpointerdown={sizeStart} onpointermove={sizeOn} onpointerup={sizeEnd} onpointercancel={sizeEnd} aria-hidden="true"></div>
			{/if}
		</div>
		{#if !floating}
			<div class="sizes" role="group" aria-label="Drawing size">
				<button class:on={size === 'hidden'} onclick={() => set('hidden')}>Hide</button>
				<button class:on={size === 'small'} onclick={() => set('small')}>Small</button>
				<button class:on={size === 'large'} onclick={() => set('large')}>Large</button>
			</div>
		{/if}
	</div>
	<div class="inputs">{@render children()}</div>
</div>

<style>
	.bench {
		display: flex;
		flex-direction: column;
	}
	.pv {
		position: sticky;
		z-index: 4;
		margin: 0 -4px;
		padding: 0 4px 6px;
		background: var(--bg);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		overflow: hidden;
		/* The 3D view takes the same height as the drawings. */
		--scene-h: var(--drawing-h);
		--scene-min: 120px;
	}
	.hidden .body {
		display: none;
	}
	.large,
	.small {
		--drawing-h: 52vh;
	}

	/* Small on a phone: a floating window in a corner, over the inputs. */
	.pv.floating {
		position: static;
		padding: 0;
		margin: 0;
		background: none;
	}
	.floating .body {
		position: fixed;
		z-index: 20;
		width: var(--fw);
		height: var(--fh);
		padding: 0 6px 6px;
		gap: 4px;
		--drawing-h: calc(var(--fh) - 64px);
		box-shadow: 0 8px 28px rgb(0 0 0 / 0.22);
		touch-action: none;
		transition: top 0.15s, left 0.15s, right 0.15s, bottom 0.15s;
	}
	.floating .body.dragging {
		transition: none;
		opacity: 0.9;
	}
	.floating .tl,
	.floating .tr {
		top: calc(var(--head) + 6px);
	}
	.floating .bl,
	.floating .br {
		bottom: calc(var(--tabbar-h, 0px) + env(safe-area-inset-bottom) + 10px);
	}
	.floating .tl,
	.floating .bl {
		left: max(10px, env(safe-area-inset-left));
	}
	.floating .tr,
	.floating .br {
		right: max(10px, env(safe-area-inset-right));
	}
	/* Just the drawing: no captions, a smaller view switch. */
	.floating .body :global(.hint) {
		display: none;
	}
	.floating .body :global(.views) {
		width: 100%;
		max-width: 13rem;
	}
	.floating .body :global(.views button) {
		font-size: 0.7rem;
		padding: 2px 0;
	}
	.grip {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 26px;
		margin: 0 -6px;
		padding: 0 6px;
		cursor: grab;
		touch-action: none;
		border-bottom: 1px solid var(--border);
	}
	.dots {
		flex: 1;
		height: 4px;
		max-width: 36px;
		margin: 0 auto 0 calc(50% - 18px);
		border-radius: 2px;
		background: var(--field-border);
	}
	.grip button {
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--primary-text);
		background: none;
		border: none;
		padding: 2px 4px;
	}
	.handle {
		position: absolute;
		width: 26px;
		height: 26px;
		touch-action: none;
	}
	.handle::after {
		content: '';
		position: absolute;
		inset: 7px;
		border: solid var(--faint);
		border-width: 0 2px 2px 0;
		border-radius: 0 0 3px 0;
	}
	.tl .handle {
		right: 0;
		bottom: 0;
		cursor: nwse-resize;
	}
	.tr .handle {
		left: 0;
		bottom: 0;
		cursor: nesw-resize;
		transform: scaleX(-1);
	}
	.bl .handle {
		right: 0;
		top: 0;
		cursor: nesw-resize;
		transform: scaleY(-1);
	}
	.br .handle {
		left: 0;
		top: 0;
		cursor: nwse-resize;
		transform: scale(-1);
	}

	.sizes {
		display: flex;
		justify-content: center;
		gap: 2px;
		margin-top: 4px;
	}
	.sizes button {
		font-size: 0.72rem;
		padding: 2px 10px;
		border-radius: 999px;
		color: var(--faint);
		background: none;
		border: none;
	}
	.sizes button.on {
		color: var(--primary-text);
		background: var(--surface-2);
		font-weight: 600;
	}
	.inputs {
		min-width: 0;
	}

	/* Wide windows: the drawing in a column of its own. */
	@media (min-width: 900px) {
		.bench {
			display: grid;
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
			gap: 20px;
			align-items: start;
		}
		.pv {
			margin: 0;
			padding: 0;
			--drawing-h: calc(100vh - var(--top) - 120px);
		}
		.pv.hidden .body {
			display: flex;
		}
		.sizes {
			display: none;
		}
		:global(.page:has(.bench)) {
			max-width: 1280px;
		}
	}
</style>
