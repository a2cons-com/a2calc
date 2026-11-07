<script lang="ts">
	import Calculator from '$lib/components/Calculator.svelte';
	import AppMark from '$lib/components/AppMark.svelte';
	import MenuButton from '$lib/components/MenuButton.svelte';
	import { calc } from '$lib/stores/app.svelte';
	import { editor } from '$lib/stores/editor.svelte';
	import { nav } from '$lib/stores/nav.svelte';
</script>

<svelte:head><title>A2 Calc</title></svelte:head>

<Calculator bind:s={calc.s} main active={!nav.open && !editor.req}>
	{#snippet lead()}
		<AppMark size={28} />
		<span class="title">A2 Calc</span>
	{/snippet}
	{#snippet trail()}
		<MenuButton />
	{/snippet}
</Calculator>

<style>
	.title {
		font-weight: 700;
		font-size: 1.15rem;
		margin-left: 2px;
	}
</style>
