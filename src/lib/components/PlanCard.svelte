<script lang="ts">
	// The "Plan | 3D" card at the top of the wall takeoffs: the floor plan
	// (tap a wall to select it) or the 3D model of the same walls.
	import { formatFtIn } from '$lib/calc/units';
	import type { Plan } from '$lib/takeoff/plan';
	import type { Scene } from '$lib/takeoff/scene';
	import { prefs } from '$lib/stores/app.svelte';
	import FloorPlan from './FloorPlan.svelte';
	import Zoom from './Zoom.svelte';
	import ViewToggle from './ViewToggle.svelte';

	let {
		plan,
		height,
		selected,
		onselect,
		scene,
		material = 'wood'
	}: {
		plan: Plan;
		height: number;
		selected: number;
		onselect: (id: number) => void;
		/** Built only while the 3D view shows. */
		scene: () => Scene;
		material?: 'wood' | 'block';
	} = $props();

	let view = $state<'plan' | '3d'>('plan');
	const walls = $derived(plan.walls.length);
</script>

<ViewToggle title="Plan" bind:view />
<div class="card plan">
	{#if view === 'plan'}
		<Zoom><FloorPlan {plan} {height} {selected} {onselect} {material} /></Zoom>
		<p class="fine hint">
			{walls > 1 ? 'Tap a wall to edit it; pinch to zoom.' : 'Add a wall to turn a corner. Pinch to zoom.'}{plan.gap ? ` The walls miss closing by ${formatFtIn(plan.gap.size, prefs.precision)}.` : ''}
		</p>
	{:else}
		{#await import('./Scene3D.svelte') then { default: Scene3D }}
			<Scene3D scene={scene()} onpick={walls > 1 ? onselect : undefined} />
		{/await}
		<p class="fine hint">{walls > 1 ? 'Tap a wall to edit it. ' : ''}Drag to turn, pinch to zoom, two fingers to move.</p>
	{/if}
</div>

<style>
	.plan {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
	}
	.hint {
		margin: -4px 0 0;
		text-align: center;
	}
</style>
