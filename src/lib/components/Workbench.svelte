<script lang="ts">
	// A takeoff laid out around its drawing, so the drawing stays in sight
	// while the inputs change. On a phone the drawing sticks under the page
	// head, small by default (tap to make it bigger, or hide it); on a wide
	// window it is a column of its own beside the inputs.
	import { onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';

	let { preview, children, id }: { preview: Snippet; children: Snippet; /** Remembers the size per tool. */ id: string } = $props();

	type Size = 'small' | 'large' | 'hidden';
	const key = () => `a2calc:preview:${id}`;
	let size = $state<Size>('small');
	try {
		const v = browser ? localStorage.getItem(key()) : null;
		if (v === 'small' || v === 'large' || v === 'hidden') size = v;
	} catch {
		/* private window: start small */
	}
	function set(v: Size) {
		size = v;
		try {
			localStorage.setItem(key(), v);
		} catch {
			/* not kept */
		}
	}

	// Stick under the page head, however tall it is (safe areas, wrap).
	let top = $state(0);
	onMount(() => {
		const head = document.querySelector('.page-head');
		if (!head) return;
		const ro = new ResizeObserver(() => (top = (head as HTMLElement).offsetHeight));
		ro.observe(head);
		return () => ro.disconnect();
	});
</script>

<div class="bench">
	<div class="pv {size}" style="top:{top}px; --top:{top}px">
		<div class="card body">{@render preview()}</div>
		<div class="sizes" role="group" aria-label="Drawing size">
			<button class:on={size === 'hidden'} onclick={() => set('hidden')}>Hide</button>
			<button class:on={size === 'small'} onclick={() => set('small')}>Small</button>
			<button class:on={size === 'large'} onclick={() => set('large')}>Large</button>
		</div>
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
	}
	.small {
		--drawing-h: 22vh;
	}
	/* Small: just the drawing, no captions under it. */
	.small .body :global(.hint) {
		display: none;
	}
	.hidden .body {
		display: none;
	}
	.large {
		--drawing-h: 52vh;
	}
	/* The 3D view takes the same height as the drawings. */
	.body {
		--scene-h: var(--drawing-h);
		--scene-min: 120px;
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
		.pv .body :global(.hint) {
			display: block;
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
