<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import AppMark from '$lib/components/AppMark.svelte';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import { frac } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	const version = __APP_VERSION__;
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
		<p>Length × length gives an area, × another length a volume. ft², ft³ and yd³ put a unit on the number you just typed (5 then ft³ is 5 cubic feet); Unit has the rest. After =, the chips or the same keys show the answer in another unit, or give a plain number one. A plain number can multiply or divide a length, but can't be added to it.</p>
		<p>Memory: after =, tap an empty letter (A to F) above the keys to keep the answer there; tap a stored letter to use it in a formula. Hold a letter, or tap M, to store over or clear.</p>
		<p>Answers round to {frac(1, prefs.precision)}″ (tap the chip at the top to change it); ≈ marks a rounded answer.</p>
	</div>

	<div class="section-title">Settings</div>
	<div class="card">
		<label class="toggle"><span>Key clicks (haptics)</span><input type="checkbox" bind:checked={prefs.haptics} /></label>
	</div>

	<div class="section-title">Please note</div>
	<div class="card fine">
		Check every number before you build or order with it. A2 Calc is an estimating aid: it is not engineering advice, and nothing it shows is a sealed or certified
		calculation. Nothing you type leaves your phone.
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
			Names of other organizations, publications and products that appear in the app are used only to identify a source and belong to their
			owners; any trademarks among them are the property of their respective owners. A2 Calc is not affiliated with, sponsored or endorsed by
			any of them.
		</p>
	</div>

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
	.made {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin: 18px 0;
	}
</style>
