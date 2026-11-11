<script lang="ts">
	// Pinch to zoom a drawing (or ⌘/Ctrl + scroll, a trackpad pinch on the
	// Mac), drag to move around it once zoomed, double-tap to zoom in or back
	// out. Taps still reach the drawing (to pick a wall); a drag doesn't.
	import type { Snippet } from 'svelte';
	let { children, max = 6 }: { children: Snippet; max?: number } = $props();

	let box: HTMLDivElement;
	let s = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	const pts = new Map<number, { x: number; y: number }>();
	let pinch: { d: number; mx: number; my: number; s: number; tx: number; ty: number } | null = null;
	let pan: { x: number; y: number; tx: number; ty: number } | null = null;
	let moved = false;
	let lastTap = 0;

	/** Keep the drawing covering the box: no empty margins past its edges. */
	function clamp() {
		const w = box.clientWidth;
		const h = box.clientHeight;
		tx = Math.min(0, Math.max(w - w * s, tx));
		ty = Math.min(0, Math.max(h - h * s, ty));
	}
	/** Zoom to `next` keeping the point (px, py) of the box still. */
	function zoomAt(next: number, px: number, py: number) {
		next = Math.max(1, Math.min(max, next));
		tx = px - ((px - tx) * next) / s;
		ty = py - ((py - ty) * next) / s;
		s = next;
		clamp();
	}
	const local = (e: { clientX: number; clientY: number }) => {
		const r = box.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};

	/** Fingers down anywhere on the page (a small drawing is easy to miss
	 * with one finger of a pinch): when did each land and where. */
	const touches = new Map<number, { t: number; e: PointerEvent }>();
	function adopt(e: PointerEvent) {
		pts.set(e.pointerId, local(e));
		try {
			box.setPointerCapture(e.pointerId);
		} catch {
			/* already up */
		}
	}
	function down(e: PointerEvent) {
		// The other finger of a pinch that landed just outside a moment ago.
		if (!pts.size && e.pointerType === 'touch') {
			for (const [id, o] of touches) if (id !== e.pointerId && performance.now() - o.t < 400) adopt(o.e);
		}
		pts.set(e.pointerId, local(e));
		moved = false;
		if (pts.size === 2) {
			const [a, b] = [...pts.values()];
			pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s, tx, ty };
			pan = null;
			box.setPointerCapture(e.pointerId);
		} else if (pts.size === 1 && s > 1) {
			const p = local(e);
			pan = { x: p.x, y: p.y, tx, ty };
		}
	}
	function move(e: PointerEvent) {
		if (!pts.has(e.pointerId)) return;
		pts.set(e.pointerId, local(e));
		if (pinch && pts.size >= 2) {
			const [a, b] = [...pts.values()];
			const d = Math.hypot(a.x - b.x, a.y - b.y);
			const next = Math.max(1, Math.min(max, (pinch.s * d) / Math.max(1, pinch.d)));
			const mx = (a.x + b.x) / 2;
			const my = (a.y + b.y) / 2;
			tx = mx - ((pinch.mx - pinch.tx) * next) / pinch.s;
			ty = my - ((pinch.my - pinch.ty) * next) / pinch.s;
			s = next;
			clamp();
			moved = true;
		} else if (pan) {
			const p = local(e);
			if (!moved && Math.hypot(p.x - pan.x, p.y - pan.y) < 5) return;
			if (!moved) box.setPointerCapture(e.pointerId);
			moved = true;
			tx = pan.tx + p.x - pan.x;
			ty = pan.ty + p.y - pan.y;
			clamp();
		}
	}
	function up(e: PointerEvent) {
		pts.delete(e.pointerId);
		if (pts.size < 2) pinch = null;
		if (!pts.size) pan = null;
		// A cancel is the browser taking the touch to scroll: not a tap.
		if (e.type === 'pointercancel') {
			lastTap = 0;
			return;
		}
		if (e.pointerType === 'touch' && !moved) {
			const now = performance.now();
			if (now - lastTap < 300) {
				const p = local(e);
				if (s > 1.01) reset();
				else zoomAt(2.5, p.x, p.y);
				lastTap = 0;
			} else lastTap = now;
		}
	}
	function wheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey)) return; // a plain scroll scrolls the page
		e.preventDefault();
		const p = local(e);
		zoomAt(s * Math.exp(-e.deltaY / 100), p.x, p.y);
	}
	function reset() {
		s = 1;
		tx = 0;
		ty = 0;
	}
	// A drag ends with a click on whatever is under it: swallow that one.
	function click(e: MouseEvent) {
		if (moved) {
			e.stopPropagation();
			e.preventDefault();
			moved = false;
		}
	}
	function dbl(e: MouseEvent) {
		const p = local(e);
		if (s > 1.01) reset();
		else zoomAt(2.5, p.x, p.y);
	}

	// Safari hands a two-finger gesture to the page (scroll, or its own
	// zoom, which ignores user-scalable=no) and cancels the pointers unless
	// the touches themselves are held: hold them once two fingers are down,
	// or one finger while zoomed (that one moves the drawing).
	function hold(e: TouchEvent) {
		if (e.touches.length >= 2 || s > 1.01) e.preventDefault();
	}
	const stop = (e: Event) => e.preventDefault();
	// The page-wide side: remember fingers; one landing off the drawing while
	// another is on it joins the pinch; while pinching, nothing else scrolls.
	function anyDown(e: PointerEvent) {
		if (e.pointerType !== 'touch') return;
		touches.set(e.pointerId, { t: performance.now(), e });
		if (pts.size === 1 && !pts.has(e.pointerId) && !box.contains(e.target as Node)) {
			down(e);
			box.setPointerCapture(e.pointerId);
		}
	}
	function anyUp(e: PointerEvent) {
		touches.delete(e.pointerId);
	}
	function anyHold(e: TouchEvent) {
		if (pinch) e.preventDefault();
	}
	$effect(() => {
		window.addEventListener('pointerdown', anyDown, true);
		window.addEventListener('pointerup', anyUp, true);
		window.addEventListener('pointercancel', anyUp, true);
		window.addEventListener('touchmove', anyHold, { passive: false });
		return () => {
			window.removeEventListener('pointerdown', anyDown, true);
			window.removeEventListener('pointerup', anyUp, true);
			window.removeEventListener('pointercancel', anyUp, true);
			window.removeEventListener('touchmove', anyHold);
		};
	});
	$effect(() => {
		box.addEventListener('wheel', wheel, { passive: false });
		box.addEventListener('touchstart', hold, { passive: false });
		box.addEventListener('touchmove', hold, { passive: false });
		box.addEventListener('gesturestart', stop);
		box.addEventListener('gesturechange', stop);
		return () => {
			box.removeEventListener('wheel', wheel);
			box.removeEventListener('touchstart', hold);
			box.removeEventListener('touchmove', hold);
			box.removeEventListener('gesturestart', stop);
			box.removeEventListener('gesturechange', stop);
		};
	});
</script>

<div
	class="zoom"
	class:zoomed={s > 1.01}
	bind:this={box}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onclickcapture={click}
	ondblclick={dbl}
	role="presentation"
>
	<div class="inner" style:transform="translate({tx}px, {ty}px) scale({s})">{@render children()}</div>
	{#if s > 1.01}
		<button class="reset" onclick={reset} aria-label="Zoom out">1:1</button>
	{/if}
</div>

<style>
	.zoom {
		position: relative;
		overflow: hidden;
		/* One finger scrolls what is around it (the page, or a strip of
		   drawings sideways) until zoomed; two always zoom. */
		touch-action: pan-x pan-y;
	}
	.zoom.zoomed {
		touch-action: none;
		cursor: grab;
	}
	.inner {
		transform-origin: 0 0;
		will-change: transform;
	}
	.reset {
		position: absolute;
		right: 6px;
		top: 6px;
		padding: 4px 9px;
		border-radius: 8px;
		font-size: 0.78rem;
		font-weight: 700;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--muted);
	}
</style>
