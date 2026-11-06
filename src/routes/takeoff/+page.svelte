<script lang="ts">
	import ToolHead from '$lib/components/ToolHead.svelte';
	import Icon from '$lib/components/Icon.svelte';
	const TOOLS = [
		{ href: '/takeoff/concrete', icon: 'slab', title: 'Concrete', text: 'Slabs, footings, walls, beams and columns, with waste and pump loss, rounded to what you order.' },
		{ href: '/takeoff/grout', icon: 'brick', title: 'Block fill grout', text: 'Grout for a CMU wall, solid or cells at a spacing, with corners and jambs. Block count too.' },
		{ href: '/takeoff/framing', icon: 'studs', title: 'Stud wall', text: 'Studs, plates, kings, jacks, headers and cripples for wood walls with doors and windows.' }
	];
</script>

<svelte:head><title>Takeoff · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="Takeoff" />
	<div class="list">
		{#each TOOLS as t (t.href)}
			<a class="tool card" href={t.href}>
				<span class="ico"><Icon name={t.icon} size={26} /></span>
				<span class="txt">
					<span class="t">{t.title}</span>
					<span class="d">{t.text}</span>
				</span>
				<span class="chev"><Icon name="chevron" size={18} /></span>
			</a>
		{/each}
	</div>
	<p class="fine note">Quick quantities for pricing and ordering. Check them against the plans and your supplier before you buy.</p>
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.tool {
		display: flex;
		align-items: center;
		gap: 14px;
		text-decoration: none;
		color: inherit;
	}
	.tool:active {
		background: var(--surface-2);
	}
	.ico {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		display: grid;
		place-items: center;
		background: var(--primary-soft);
		color: var(--primary-text);
		flex: none;
	}
	.txt {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: 1;
	}
	.t {
		font-weight: 650;
		font-size: 1.05rem;
	}
	.d {
		font-size: 0.86rem;
		color: var(--muted);
		line-height: 1.35;
	}
	.chev {
		color: var(--faint);
	}
	.note {
		margin: 18px 6px;
	}
</style>
