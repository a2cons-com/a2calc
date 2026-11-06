<script lang="ts">
	import Icon from './Icon.svelte';
	let { title }: { title: string } = $props();
</script>

<div class="page-head">
	<a class="icon-btn back" href="/takeoff" aria-label="Back to takeoff"><Icon name="back" /></a>
	<h1>{title}</h1>
</div>

<style>
	.back {
		margin-left: -10px;
		color: var(--primary-text);
	}
</style>
