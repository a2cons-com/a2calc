<script lang="ts">
	// The app's own mark: the icon (four keys), drawn as a rounded tile.
	import icon from '$lib/assets/app-icon.svg?raw';
	let { size = 28 }: { size?: number } = $props();
</script>

<span class="mark" style="width:{size}px;height:{size}px;border-radius:{size * 0.225}px">{@html icon}</span>

<style>
	.mark {
		display: inline-block;
		overflow: hidden;
		flex: none;
		box-shadow: 0 0 0 1px var(--border);
	}
	.mark :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
