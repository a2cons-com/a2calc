<script lang="ts">
	import mark from '$lib/assets/a2-mark.svg?raw';
	let { size = 28 }: { size?: number } = $props();
</script>

<span class="logo" style="height:{size}px;width:{(size * 985) / 418}px">{@html mark}</span>

<style>
	.logo {
		display: inline-block;
		color: var(--primary-text);
		flex: none;
	}
	.logo :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
