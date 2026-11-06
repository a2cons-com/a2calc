<script lang="ts">
	// A bottom sheet: slides up over the page, closes on the backdrop.
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	let { open = $bindable(false), title = '', children, actions }: { open?: boolean; title?: string; children: Snippet; actions?: Snippet } = $props();
</script>

{#if open}
	<div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => (open = false)} role="presentation"></div>
	<div class="sheet" role="dialog" aria-label={title} transition:fly={{ y: 400, duration: 220 }}>
		<div class="grab"></div>
		{#if title || actions}
			<div class="head">
				<h2>{title}</h2>
				{@render actions?.()}
			</div>
		{/if}
		<div class="body">{@render children()}</div>
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
