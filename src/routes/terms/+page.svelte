<script lang="ts">
	import ToolHead from '$lib/components/ToolHead.svelte';
	import LegalText from '$lib/components/LegalText.svelte';
	import text from '../../../TERMS.md?raw';
</script>

<svelte:head><title>Terms of Use · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Terms of Use" back="/about" />
	<LegalText {text} />
</div>
