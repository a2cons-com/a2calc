<script lang="ts">
	// The app's own mark: the icon (four keys), drawn as a rounded tile; the
	// dark-mode icon when the app is dark, as on the home screen.
	import icon from '$lib/assets/app-icon.svg?raw';
	import iconDark from '$lib/assets/app-icon-dark.svg?raw';
	let { size = 28 }: { size?: number } = $props();
</script>

<span class="mark" style="width:{size}px;height:{size}px;border-radius:{size * 0.225}px">
	<span class="light">{@html icon}</span><span class="dark">{@html iconDark}</span>
</span>

<style>
	.mark {
		display: inline-block;
		overflow: hidden;
		flex: none;
		box-shadow: 0 0 0 1px var(--border);
	}
	.mark span {
		display: block;
		width: 100%;
		height: 100%;
	}
	.mark :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.dark,
	:global(:root[data-theme='dark']) .light {
		display: none !important;
	}
	:global(:root[data-theme='dark']) .dark {
		display: block !important;
	}
</style>
