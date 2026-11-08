<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import AppMark from '$lib/components/AppMark.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import { frac } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import appLicense from '../../../LICENSE?raw';
	import thirdParty from '$lib/licenses.json';
	const version = __APP_VERSION__;
	const SOURCE = 'https://github.com/a2cons-com/a2calc';

	/** The license text open in the sheet. */
	let shown = $state<{ title: string; text: string } | null>(null);
	let sheetOpen = $state(false);
	function show(title: string, text: string) {
		// Join hard-wrapped lines so the text flows to the phone's width.
		shown = { title, text: text.replace(/([^\n])\n(?![\n*\-])/g, '$1 ') };
		sheetOpen = true;
	}
</script>

<svelte:head><title>About · A2 Calc</title></svelte:head>

<div class="page">
	<ToolHead title="About" />

	<div class="brand card">
		<AppMark size={52} />
		<div>
			<div class="name">A2 Calc</div>
			<div class="fine">by A2 Labs · version {version}</div>
			<div class="fine">Free, no ads, no account</div>
		</div>
	</div>

	<div class="section-title">Typing feet and inches</div>
	<div class="card help">
		<p>Read it like a tape: feet, then inches, then the fraction.</p>
		<dl class="num">
			<dt>5 ′</dt><dd>5′</dd>
			<dt>5 ′ 3</dt><dd>5′ 3″</dd>
			<dt>5 ′ 3 ″ 1 / 2</dt><dd>5′ 3 {frac(1, 2)}″</dd>
			<dt>3 / 4 ″</dt><dd>{frac(3, 4)}″</dd>
			<dt>12.5 ′</dt><dd>12′ 6″</dd>
		</dl>
		<p>Nothing is worked out until you press =, so type the whole formula first. × and ÷ go before + and −; use ( ) to change that. Parentheses left open close at =.</p>
		<p>After + or −, the next number takes the unit of the one before, typed, picked from the tape or an answer (5 cu ft + 3 is 3 cu ft; 12′ + 4 is 4′; 12′ 6″ + 4 is 4′), but a bare fraction next to a length is inches, as on a tape (12′ + 3/4 is 12′ ¾″); tap ′ or ″ to change it. × and ÷ leave numbers plain, so 12′ × 3 is 36′.</p>
		<p>Length × length gives an area, × another length a volume. Tap ′ again for square feet and again for cubic feet (″ does the same with inches), or hold the key to choose; Unit has the rest. After =, tap ′ to switch the answer between feet-inches and decimal feet (sq ft / sq yd, cu ft / cu yd), tap ″ for inches with fractions or decimal inches (sq in, cu in), or hold either for every unit; a plain number becomes feet or inches. A plain number can multiply or divide a length, but can't be added to it.</p>
		<p>Memory: after =, tap an empty letter (A to F) above the keys to keep the answer there; tap a stored letter to use it in a formula. Hold a letter, or tap M, to store over or clear.</p>
		<p>Every dimension in a takeoff opens the same calculator: type a new value, or work on the current one (+ 2′, × 3, a memory letter), then Done. A plain number there is feet or inches, as the field says.</p>
		<p>Projects (in the menu) keep a job's takeoffs together on this device: save any takeoff to a project, and changes are saved as you make them. Export a project or a single takeoff as a PDF report (totals, drawings, cut list, what to buy) or a spreadsheet (CSV).</p>
		<p>Answers round to {frac(1, prefs.precision)}″ (tap the chip at the top to change it); ≈ marks a rounded answer.</p>
	</div>

	<div class="section-title">Settings</div>
	<div class="card">
		<label class="toggle"><span>Key clicks (haptics)</span><input type="checkbox" bind:checked={prefs.haptics} /></label>
	</div>

	<div class="section-title">Use at your own risk</div>
	<div class="card fine">
		A2 Calc is an estimating aid, provided free and as is. Check every number before you build, order or bid with it: it is not engineering advice,
		nothing it shows is a sealed or certified calculation, and A2 Labs takes no responsibility for how its results are used. Nothing you type leaves
		your phone.
		<div class="docs">
			<a href="/terms">Terms of Use</a>
			<a href="/privacy">Privacy Policy</a>
		</div>
	</div>

	<div class="section-title">Sources</div>
	<div class="card fine">
		Block fill grout: an industry technical note on estimating masonry materials; the grout screen gives the full citation. Concrete waste
		and pump allowances, stud layout and framing rules are common trade practice.
	</div>

	<div class="section-title">Legal</div>
	<div class="card fine legal">
		<p>© {new Date().getFullYear()} A2 Labs. A2 Calc is made by A2 Labs.</p>
		<p>
			A2 Calc is free, open-source software under the
			<button class="link" onclick={() => show('A2 Calc · MIT License', appLicense)}>MIT License</button>. The source code is at
			<a href={SOURCE} target="_blank" rel="noopener">github.com/a2cons-com/a2calc</a>.
		</p>
		<p>The license covers the code. The A2 Calc name, the A2 logo and the app's icon identify A2 Labs; they are not licensed for other apps, including forks.</p>
		<p>
			Names of other organizations, publications and products that appear in the app are used only to identify a source and belong to their
			owners; any trademarks among them are the property of their respective owners. A2 Calc is not affiliated with, sponsored or endorsed by
			any of them.
		</p>
	</div>

	<div class="section-title">Open-source software</div>
	<div class="card oss">
		<p class="fine">A2 Calc is built with these open-source packages. Tap one for its license.</p>
		{#each thirdParty as p (p.name)}
			<button class="row" onclick={() => show(`${p.name} ${p.version}`, p.text)}>
				<span class="pkg">{p.name}<small>{p.version}</small></span>
				<span class="lic">{p.license}</span>
				<Icon name="chevron" size={16} />
			</button>
		{/each}
	</div>

	<Sheet bind:open={sheetOpen} title={shown?.title ?? ''}>
		<pre class="license">{shown?.text}</pre>
	</Sheet>

	<p class="fine made"><Logo size={20} /><span>Made by A2 Labs</span></p>
</div>

<style>
	.brand {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.name {
		font-size: 1.3rem;
		font-weight: 700;
	}
	.help p {
		margin: 0 0 10px;
		line-height: 1.45;
	}
	dl {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px 16px;
		margin: 0 0 12px;
		padding: 10px 12px;
		background: var(--bg);
		border-radius: 10px;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-weight: 600;
		text-align: right;
	}
	.toggle {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.toggle input {
		width: 22px;
		height: 22px;
		accent-color: var(--primary);
	}
	.legal p {
		margin: 0 0 8px;
	}
	.legal p:last-child {
		margin: 0;
	}
	.docs {
		display: flex;
		gap: 18px;
		margin-top: 10px;
	}
	.docs a {
		color: var(--primary-text);
		font-weight: 600;
	}
	.link {
		color: var(--primary-text);
		font-weight: 600;
		text-decoration: underline;
		padding: 0;
		font-size: inherit;
	}
	.legal a {
		color: var(--primary-text);
		font-weight: 600;
	}
	.oss {
		padding: 12px 6px 6px;
	}
	.oss .fine {
		margin: 0 10px 6px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px;
		text-align: left;
		color: var(--text);
		border-top: 1px solid var(--border);
	}
	.pkg {
		flex: 1;
		font-weight: 600;
		font-size: 0.92rem;
	}
	.pkg small {
		margin-left: 6px;
		color: var(--faint);
		font-weight: 500;
	}
	.lic {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.row :global(svg) {
		color: var(--faint);
	}
	.license {
		white-space: pre-wrap;
		font-family: var(--font);
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--muted);
		margin: 0;
		user-select: text;
		-webkit-user-select: text;
	}
	.made {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin: 18px 0;
	}
</style>
