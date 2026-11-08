<script lang="ts">
	import { p } from '$lib/paths';
	// Header of a secondary screen: back to the calculator, the title, the menu.
	import Icon from './Icon.svelte';
	import MenuButton from './MenuButton.svelte';
	let { title, back = '/' }: { title: string; back?: string } = $props();
</script>

<div class="page-head">
	<a class="icon-btn back" href={p(back)} aria-label="Back"><Icon name="back" /></a>
	<h1>{title}</h1>
	<MenuButton />
</div>

<style>
	.back {
		margin-left: -10px;
		color: var(--primary-text);
	}
</style>
