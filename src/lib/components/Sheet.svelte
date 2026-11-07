<script lang="ts">
	// A bottom sheet: slides up over the page, closes on the backdrop, on
	// Escape, or by dragging it down (by its top bar, or from anywhere once
	// its content is scrolled to the top).
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	let { open = $bindable(false), title = '', children, actions }: { open?: boolean; title?: string; children: Snippet; actions?: Snippet } = $props();

	let drag = $state(0);
	let dragging = $state(false);
	let body: HTMLDivElement | undefined = $state();
	let start: { y: number; t: number } | null = null;
	let last = { y: 0, t: 0 };

	function begin(y: number) {
		start = { y, t: performance.now() };
		last = { ...start };
	}
	/** Follow the finger; false when the move isn't a drag down. */
	function move(y: number): boolean {
		if (!start) return false;
		const dy = y - start.y;
		if (!dragging && dy <= 4) {
			if (dy < -4) start = null; // scrolling up: let the content have it
			return false;
		}
		dragging = true;
		drag = Math.max(0, dy);
		last = { y, t: performance.now() };
		return true;
	}
	function end() {
		if (!start) return;
		const speed = (last.y - start.y) / Math.max(1, last.t - start.t);
		const close = dragging && (drag > 110 || (drag > 30 && speed > 0.5));
		start = null;
		dragging = false;
		if (close) open = false;
		else drag = 0;
	}

	// The top bar drags with the mouse or a finger.
	function grabDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button, a, input, select')) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		begin(e.clientY);
	}
	// The content drags only from the top of its scroll, and only downward.
	$effect(() => {
		const el = body;
		if (!el) return;
		const ts = (e: TouchEvent) => {
			if (el.scrollTop <= 0) begin(e.touches[0].clientY);
		};
		const tm = (e: TouchEvent) => {
			if (move(e.touches[0].clientY)) e.preventDefault();
		};
		el.addEventListener('touchstart', ts, { passive: true });
		el.addEventListener('touchmove', tm, { passive: false });
		el.addEventListener('touchend', end);
		el.addEventListener('touchcancel', end);
		return () => {
			el.removeEventListener('touchstart', ts);
			el.removeEventListener('touchmove', tm);
			el.removeEventListener('touchend', end);
			el.removeEventListener('touchcancel', end);
		};
	});

	// Slides in from below, and out from wherever the drag left it.
	function slide(node: HTMLElement) {
		const from = drag;
		const h = node.offsetHeight;
		return {
			duration: 220,
			easing: cubicOut,
			css: (t: number) => `transform: translateY(${from + (1 - t) * (h - from)}px)`
		};
	}

	$effect(() => {
		if (open) drag = 0;
	});
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') open = false; }} />

{#if open}
	<div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => (open = false)} role="presentation"></div>
	<div class="sheet" class:dragging role="dialog" aria-label={title} transition:slide style:transform={drag ? `translateY(${drag}px)` : null}>
		<div
			class="top"
			onpointerdown={grabDown}
			onpointermove={(e) => start && move(e.clientY)}
			onpointerup={end}
			onpointercancel={end}
			role="presentation"
		>
			<div class="grab"></div>
			{#if title || actions}
				<div class="head">
					<h2>{title}</h2>
					{@render actions?.()}
				</div>
			{/if}
		</div>
		<div class="body" bind:this={body} style:overscroll-behavior="contain">{@render children()}</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		z-index: 40;
	}
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 41;
		max-height: 88dvh;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		padding: 6px 16px calc(env(safe-area-inset-bottom) + 12px);
		max-width: 720px;
		margin: 0 auto;
		box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.18);
	}
	.sheet:not(.dragging) {
		transition: transform 0.2s ease-out;
	}
	.top {
		flex: none;
		touch-action: none;
		cursor: grab;
		margin: -6px -16px 0;
		padding: 6px 16px 0;
	}
	.grab {
		width: 38px;
		height: 5px;
		border-radius: 3px;
		background: var(--border);
		margin: 4px auto 8px;
		flex: none;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
		flex: none;
	}
	.head h2 {
		flex: 1;
		font-size: 1.1rem;
	}
	.body {
		overflow-y: auto;
		min-height: 0;
	}
</style>
