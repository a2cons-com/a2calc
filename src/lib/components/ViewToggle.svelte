<script lang="ts" generics="V extends string">
	// A section title with a small segmented switch between drawings
	// (Plan / 3D, or Sketch / Plan / 3D).
	let {
		title,
		view = $bindable(),
		views = [
			['plan', 'Plan'],
			['3d', '3D']
		] as [V, string][]
	}: { title: string; view: V; views?: [V, string][] } = $props();
</script>

<div class="section-title head">
	<span>{title}</span>
	<div class="seg" style="width:{views.length * 4.5}rem">
		{#each views as [id, label] (id)}
			<button class:on={view === id} onclick={() => (view = id)}>{label}</button>
		{/each}
	</div>
</div>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.seg button {
		padding: 4px 0;
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: 0;
	}
</style>
