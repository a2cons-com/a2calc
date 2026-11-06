<script lang="ts">
	import ToolHead from '$lib/components/ToolHead.svelte';
	import LegalText from '$lib/components/LegalText.svelte';
	import text from '../../../PRIVACY.md?raw';
</script>

<svelte:head><title>Privacy Policy · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Privacy Policy" back="/about" />
	<LegalText {text} />
</div>
