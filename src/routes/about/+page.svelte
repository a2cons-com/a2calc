<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { frac } from '$lib/calc/units';
	import { prefs } from '$lib/stores/app.svelte';
	const version = __APP_VERSION__;
</script>

<svelte:head><title>About · A2 Calc</title></svelte:head>

<div class="page">
	<div class="page-head">
		<a class="icon-btn back" href="/" aria-label="Back"><Icon name="back" /></a>
		<h1>About</h1>
	</div>

	<div class="brand card">
		<Logo size={40} />
		<div>
			<div class="name">A2 Calc</div>
			<div class="fine">Version {version} · free, no ads, no account</div>
		</div>
	</div>

	<div class="section-title">Typing feet and inches</div>
	<div class="card help">
		<p>Read it like a tape: feet, then inches, then the fraction.</p>
		<dl class="num">
			<dt>5 ′</dt><dd>5′</dd>
			<dt>5 ′ 3</dt><dd>5′ 3″</dd>
			<dt>5 ′ 3 ″ 1 ⁄ 2</dt><dd>5′ 3 {frac(1, 2)}″</dd>
			<dt>3 ⁄ 4 ″</dt><dd>{frac(3, 4)}″</dd>
			<dt>12.5 ′</dt><dd>12′ 6″</dd>
		</dl>
		<p>Length × length gives an area, × another length a volume; tap the unit chips under an answer to see it in other units. A plain number with no unit can multiply or divide, but can't be added to a length.</p>
		<p>Answers round to {frac(1, prefs.precision)}″ (tap the chip at the top to change it); ≈ marks a rounded answer.</p>
	</div>

	<div class="section-title">Settings</div>
	<div class="card">
		<label class="toggle"><span>Key clicks (haptics)</span><input type="checkbox" bind:checked={prefs.haptics} /></label>
	</div>

	<div class="section-title">Please note</div>
	<div class="card fine">
		Check every number before you build or order with it. A2 Calc is an estimating aid: it is not engineering advice, and nothing it shows is a sealed or certified
		calculation. Grout volumes follow CMHA / NCMA TEK 4-2A. Nothing you type leaves your phone.
	</div>

	<p class="fine made">Made by <a href="https://a2cons.com" target="_blank" rel="noopener">A2 Construction</a></p>
</div>

<style>
	.back {
		margin-left: -10px;
		color: var(--primary-text);
	}
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
	.made {
		text-align: center;
		margin: 18px 0;
	}
</style>
