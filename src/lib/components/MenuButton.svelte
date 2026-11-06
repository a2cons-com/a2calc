<script lang="ts">
	import Icon from './Icon.svelte';
	import { nav } from '$lib/stores/nav.svelte';
</script>

<button class="icon-btn" onclick={() => (nav.open = true)} aria-label="Menu"><Icon name="menu" /></button>
