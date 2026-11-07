<script lang="ts">
	// Pick PDF or CSV, then make the file and share it.
	import Sheet from './Sheet.svelte';
	import Icon from './Icon.svelte';
	import { exportTakeoffs, type ExportFormat } from '$lib/export';
	import { prefs } from '$lib/stores/app.svelte';
	import type { Project, Takeoff } from '$lib/stores/projects.svelte';

	let { open = $bindable(false), project, takeoffs }: { open?: boolean; project: Project; takeoffs: Takeoff[] } = $props();

	let busy = $state<ExportFormat | null>(null);
	let error = $state('');

	async function go(f: ExportFormat) {
		busy = f;
		error = '';
		try {
			await exportTakeoffs(project, takeoffs, f, prefs.precision);
			open = false;
		} catch (e) {
			error = `Couldn't make the file${e instanceof Error && e.message ? ` (${e.message})` : ''}.`;
		} finally {
			busy = null;
		}
	}
	const what = $derived(takeoffs.length === 1 ? takeoffs[0].name : `${takeoffs.length} takeoffs`);
</script>

<Sheet bind:open title="Export">
	<p class="fine lead">{project.name} · {what}</p>
	<div class="opts">
		<button class="opt" onclick={() => go('pdf')} disabled={!!busy}>
			<span class="ico"><Icon name="share" /></span>
			<span class="txt"><b>PDF report</b><small>Totals, drawings, cut list and what to buy, to send or print</small></span>
			{#if busy === 'pdf'}<span class="spin" aria-label="Working"></span>{/if}
		</button>
		<button class="opt" onclick={() => go('csv')} disabled={!!busy}>
			<span class="ico"><Icon name="share" /></span>
			<span class="txt"><b>Spreadsheet (CSV)</b><small>Every line, for Excel, Numbers or an estimating program</small></span>
			{#if busy === 'csv'}<span class="spin" aria-label="Working"></span>{/if}
		</button>
	</div>
	{#if error}<p class="warn">{error}</p>{/if}
</Sheet>

<style>
	.lead {
		margin: -4px 2px 12px;
	}
	.opts {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 6px;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		border-radius: 14px;
		background: var(--field);
		border: 1px solid var(--field-border);
		text-align: left;
		color: var(--text);
	}
	.opt:disabled {
		opacity: 0.6;
	}
	.ico {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		background: var(--primary-soft);
		color: var(--primary-text);
		flex: none;
	}
	.txt {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}
	.txt small {
		color: var(--muted);
		font-size: 0.82rem;
	}
	.spin {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2.5px solid var(--border);
		border-top-color: var(--primary);
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
