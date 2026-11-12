<script lang="ts">
	import { p } from '$lib/paths';
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
	import { autosave } from '$lib/stores/projects.svelte';

	// Project takeoffs open on a screen are saved as they change.
	autosave();

	// Every screen, behind the menu button in each header: the calculator
	// keeps the whole screen.
	const MENU: { title: string; items: { href: string; label: string; icon: string }[] }[] = [
		{
			title: '',
			items: [
				{ href: '/', label: 'Calculator', icon: 'calc' },
				{ href: '/convert', label: 'Convert', icon: 'convert' },
				{ href: '/projects', label: 'Projects', icon: 'folder' }
			]
		},
		{
			title: 'Takeoff',
			items: [
				{ href: '/takeoff/concrete', label: 'Concrete', icon: 'slab' },
				{ href: '/takeoff/grout', label: 'Block grout', icon: 'brick' },
				{ href: '/takeoff/framing', label: 'Stud wall', icon: 'studs' },
				{ href: '/takeoff/stairs', label: 'Stairs', icon: 'stairs' },
				{ href: '/takeoff/flooring', label: 'Flooring', icon: 'floor' },
				{ href: '/takeoff/wall-tile', label: 'Wall tile', icon: 'walltile' }
			]
		}
	];
	const active = (href: string) => {
		const at = page.url.pathname.slice(p('').length) || '/';
		return at === href || (href !== '/' && at.startsWith(href + '/'));
	};

	// Light or dark: the choice in the menu, or the phone's setting. The
	// status bar (iOS, Android) and the Mac window follow it.
	let systemDark = $state(typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
	const dark = $derived(prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark));
	$effect(() => {
		const mq = matchMedia('(prefers-color-scheme: dark)');
		const on = () => (systemDark = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});
	$effect(() => {
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		const mac = (window as unknown as { webkit?: { messageHandlers?: { theme?: { postMessage(m: string): void } } } }).webkit?.messageHandlers?.theme;
		mac?.postMessage(prefs.theme);
		if (isNative()) {
			import('@capacitor/status-bar')
				.then(({ StatusBar, Style }) => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }))
				.catch(() => {});
		}
	});
	const THEMES = [
		{ id: 'system', label: 'Auto' },
		{ id: 'light', label: 'Light' },
		{ id: 'dark', label: 'Dark' }
	] as const;

	let disclaimer = $state(!prefs.disclaimerSeen);
	$effect(() => {
		if (!disclaimer) prefs.disclaimerSeen = true;
	});

	onMount(async () => {
		// Windows app (Tauri): a link that opens a new window would be
		// dropped there, so send outside links through the main window, where
		// the app hands them to the default browser.
		if ('__TAURI_INTERNALS__' in window) {
			document.addEventListener('click', (e) => {
				const a = (e.target as HTMLElement | null)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
				if (a && a.href && new URL(a.href).origin !== location.origin) {
					e.preventDefault();
					location.href = a.href;
				}
			});
		}
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
		{#each MENU as g (g.title)}
			{#if g.title}<div class="section-title">{g.title}</div>{/if}
			<div class="tiles">
				{#each g.items as m (m.href)}
					<a href={p(m.href)} class="tile" class:on={active(m.href)} aria-current={active(m.href) ? 'page' : undefined} onclick={() => (nav.open = false)}>
						<span class="ico"><Icon name={m.icon} size={30} /></span>
						<span class="lbl">{m.label}</span>
					</a>
				{/each}
			</div>
		{/each}
		<a href={p('/about')} class="row" class:on={active('/about')} onclick={() => (nav.open = false)}>
			<Icon name="info" size={20} /><span>About and help</span>
		</a>
	</nav>
	<div class="theme">
		<span class="section-title">Appearance</span>
		<div class="seg" role="radiogroup" aria-label="Appearance">
			{#each THEMES as t (t.id)}
				<button class:on={prefs.theme === t.id} role="radio" aria-checked={prefs.theme === t.id} onclick={() => (prefs.theme = t.id)}>{t.label}</button>
			{/each}
		</div>
	</div>
</Sheet>

<ValueEditor />

<Sheet bind:open={disclaimer} title="">
	<div class="welcome">
		<AppMark size={64} />
		<h2>Welcome to A2 Calc</h2>
		<p class="by">by A2 Labs</p>
		<p>Feet, inches and fractions; areas and volumes; quick concrete, block grout and stud wall takeoffs. Free, with no ads and no account.</p>
		<p class="fine">
			Use at your own risk: A2 Calc is an estimating aid, not engineering advice, and nothing it shows is a sealed or certified calculation. Check every
			number before you build, order or bid with it. By using the app you agree to the <a href={p('/terms')} onclick={() => (disclaimer = false)}>Terms of Use</a>; it collects
			nothing (<a href={p('/privacy')} onclick={() => (disclaimer = false)}>Privacy Policy</a>).
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
		gap: 4px;
		padding-bottom: 4px;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 8px;
		margin-bottom: 6px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 4px 12px;
		border-radius: 18px;
		background: var(--field);
		border: 1px solid var(--field-border);
		color: var(--text);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.88rem;
		text-align: center;
		line-height: 1.15;
	}
	.tile:active {
		filter: brightness(0.96);
	}
	.tile .ico {
		width: 54px;
		height: 54px;
		border-radius: 16px;
		display: grid;
		place-items: center;
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.tile.on {
		border-color: var(--primary);
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.tile.on .ico {
		background: var(--primary);
		color: var(--primary-ink);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 8px;
		margin-top: 2px;
		border-radius: 12px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 600;
	}
	.row.on {
		color: var(--primary-text);
	}
	.menu .section-title {
		margin: 6px 4px 6px;
	}
	.theme {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 10px 8px 6px;
	}
	.theme .section-title {
		margin: 0;
		flex: none;
	}
	.theme .seg {
		flex: 1;
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
	.welcome .by {
		margin-top: -6px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
	}
	.welcome a {
		color: var(--primary-text);
		font-weight: 600;
	}
	.welcome .btn {
		width: 100%;
		margin-top: 10px;
		padding: 14px;
	}
</style>
