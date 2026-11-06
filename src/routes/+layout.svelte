<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import ValueEditor from '$lib/components/ValueEditor.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import AppMark from '$lib/components/AppMark.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { prefs } from '$lib/stores/app.svelte';
	import { isNative } from '$lib/native';
	import { onMount } from 'svelte';

	let { children } = $props();

	const TABS = [
		{ href: '/', label: 'Calculator', icon: 'calc' },
		{ href: '/convert', label: 'Convert', icon: 'convert' },
		{ href: '/takeoff', label: 'Takeoff', icon: 'takeoff' }
	];
	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));

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
	<nav class="tabbar" aria-label="Sections">
		{#each TABS as t (t.href)}
			<a href={t.href} class:on={active(t.href)} aria-current={active(t.href) ? 'page' : undefined}>
				<Icon name={t.icon} size={24} />
				<span>{t.label}</span>
			</a>
		{/each}
	</nav>
</div>

<ValueEditor />

<Sheet bind:open={disclaimer} title="">
	<div class="welcome">
		<AppMark size={64} />
		<h2 class="wtitle">Welcome to <Logo size={24} /> Calc</h2>
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
	.tabbar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		display: flex;
		justify-content: space-around;
		height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-top: 1px solid var(--border);
	}
	.tabbar a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		color: var(--faint);
		text-decoration: none;
		font-size: 0.7rem;
		font-weight: 600;
	}
	.tabbar a.on {
		color: var(--primary-text);
	}
	/* On its side the tab bar gets slim: icon and label in one line. */
	@media (orientation: landscape) and (max-height: 540px) {
		:global(:root) {
			--tabbar-h: 40px;
		}
		.tabbar a {
			flex-direction: row;
			gap: 6px;
			font-size: 0.8rem;
		}
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
	.wtitle {
		display: flex;
		align-items: center;
		gap: 7px;
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
