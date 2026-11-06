<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import ValueEditor from '$lib/components/ValueEditor.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import AppMark from '$lib/components/AppMark.svelte';
	import { prefs } from '$lib/stores/app.svelte';
	import { isNative } from '$lib/native';
	import { onMount } from 'svelte';

	let { children } = $props();

	import { nav } from '$lib/stores/nav.svelte';

	// Every screen, behind the menu button in each header: the calculator
	// keeps the whole screen.
	const MENU = [
		{ href: '/', label: 'Calculator', icon: 'calc' },
		{ href: '/convert', label: 'Convert', icon: 'convert' },
		{ section: 'Takeoff' },
		{ href: '/takeoff/concrete', label: 'Concrete', icon: 'slab' },
		{ href: '/takeoff/grout', label: 'Block fill grout', icon: 'brick' },
		{ href: '/takeoff/framing', label: 'Stud wall', icon: 'studs' },
		{ section: '' },
		{ href: '/about', label: 'About and help', icon: 'info' }
	];
	const active = (href: string) => page.url.pathname === href;

	let disclaimer = $state(!prefs.disclaimerSeen);
	$effect(() => {
		if (!disclaimer) prefs.disclaimerSeen = true;
	});

	onMount(async () => {
		if (!isNative()) return;
		const { SplashScreen } = await import('@capacitor/splash-screen');
		SplashScreen.hide().catch(() => {});
	});
</script>

<div class="app">
	<main>{@render children()}</main>
</div>

<Sheet bind:open={nav.open} title="">
	<nav class="menu" aria-label="Screens">
		{#each MENU as m, i (i)}
			{#if 'section' in m}
				{#if m.section}<div class="section-title">{m.section}</div>{:else}<div class="gap"></div>{/if}
			{:else}
				<a href={m.href} class:on={active(m.href ?? '')} aria-current={active(m.href ?? '') ? 'page' : undefined} onclick={() => (nav.open = false)}>
					<span class="ico"><Icon name={m.icon ?? ''} size={22} /></span>
					<span>{m.label}</span>
				</a>
			{/if}
		{/each}
	</nav>
</Sheet>

<ValueEditor />

<Sheet bind:open={disclaimer} title="">
	<div class="welcome">
		<AppMark size={64} />
		<h2>Welcome to A2 Calc</h2>
		<p>Feet, inches and fractions; areas and volumes; quick concrete, block grout and stud wall takeoffs. Free, with no ads and no account.</p>
		<p class="fine">
			Check every number before you build or order with it. A2 Calc is an estimating aid: it is not engineering advice, and nothing it shows is a sealed or certified calculation.
		</p>
		<button class="btn solid" onclick={() => (disclaimer = false)}>Got it</button>
	</div>
</Sheet>

<style>
	.app {
		min-height: 100dvh;
	}
	main {
		min-height: 100dvh;
	}
	.menu {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-bottom: 4px;
	}
	.menu a {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 8px;
		border-radius: 12px;
		color: var(--text);
		text-decoration: none;
		font-weight: 600;
		font-size: 1.05rem;
	}
	.menu a:active {
		background: var(--surface-2);
	}
	.menu a.on {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.menu .ico {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--primary-text);
	}
	.menu .section-title {
		margin: 14px 8px 4px;
	}
	.menu .gap {
		height: 10px;
	}
	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 10px;
		padding: 8px 8px 4px;
	}
	.welcome h2 {
		font-size: 1.35rem;
		margin-top: 6px;
	}
	.welcome p {
		margin: 0;
		line-height: 1.45;
	}
	.welcome .btn {
		width: 100%;
		margin-top: 10px;
		padding: 14px;
	}
</style>
