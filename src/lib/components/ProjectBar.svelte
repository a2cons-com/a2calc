<script lang="ts">
	// Under a takeoff screen's title: which project takeoff this is (saved as
	// it changes), or a Save to project button; and Export.
	import { goto } from '$app/navigation';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import ExportSheet from './ExportSheet.svelte';
	import { concrete, grout, wall } from '$lib/stores/app.svelte';
	import {
		closeTakeoff,
		createProject,
		editing,
		findTakeoff,
		KIND_NAME,
		projects,
		saveScreen,
		type Project,
		type TakeoffKind
	} from '$lib/stores/projects.svelte';

	let { kind }: { kind: TakeoffKind } = $props();

	const linked = $derived(findTakeoff(editing[kind]));

	let saveOpen = $state(false);
	let exportOpen = $state(false);
	let renameOpen = $state(false);
	let pick = $state<number | 'new'>('new');
	let projectName = $state('');
	let takeoffName = $state('');
	let rename = $state('');

	function openSave() {
		pick = projects.list[0]?.id ?? 'new';
		projectName = '';
		takeoffName = KIND_NAME[kind];
		saveOpen = true;
	}
	function save() {
		const id = pick === 'new' ? createProject(projectName || 'Untitled project').id : pick;
		saveScreen(kind, id, takeoffName);
		saveOpen = false;
	}
	function doRename() {
		if (linked && rename.trim()) linked.takeoff.name = rename.trim();
		renameOpen = false;
	}

	// Exporting a takeoff that isn't in a project: a one-off project of it.
	const STORE = { framing: wall, grout, concrete };
	const scratch = $derived<Project>({
		id: 0,
		name: KIND_NAME[kind],
		note: '',
		created: 0,
		updated: 0,
		takeoffs: [{ id: 0, kind, name: KIND_NAME[kind], data: STORE[kind], updated: 0 }]
	});
	const exportProject = $derived(linked ? linked.project : scratch);
	const exportTakeoffs = $derived(linked ? [linked.takeoff] : scratch.takeoffs);
</script>

<div class="bar">
	{#if linked}
		<button class="where" onclick={() => goto(`/projects?p=${linked.project.id}`)}>
			<Icon name="folder" size={18} />
			<span class="names"><span class="proj">{linked.project.name}</span><span class="sep">›</span><span class="tk">{linked.takeoff.name}</span></span>
		</button>
		<button class="icon-btn sm" aria-label="Rename" onclick={() => ((rename = linked.takeoff.name), (renameOpen = true))}><Icon name="pencil" size={18} /></button>
		<button class="icon-btn sm" aria-label="Export" onclick={() => (exportOpen = true)}><Icon name="share" size={19} /></button>
		<button class="icon-btn sm" aria-label="Close the project takeoff" onclick={() => closeTakeoff(kind)}><Icon name="close" size={18} /></button>
	{:else}
		<button class="btn soft save" onclick={openSave}><Icon name="folder" size={18} /> Save to project</button>
		<button class="btn soft" onclick={() => (exportOpen = true)} aria-label="Export"><Icon name="share" size={18} /> Export</button>
	{/if}
</div>
{#if linked}<p class="fine saved">Saved as you go.</p>{/if}

<ExportSheet bind:open={exportOpen} project={exportProject} takeoffs={exportTakeoffs} />

<Sheet bind:open={saveOpen} title="Save to project">
	<div class="form">
		<label class="lbl" for="tk-name">Takeoff name</label>
		<input id="tk-name" class="text" bind:value={takeoffName} placeholder={KIND_NAME[kind]} autocomplete="off" />
		<span class="lbl">Project</span>
		<div class="choices">
			<button class="choice" class:on={pick === 'new'} onclick={() => (pick = 'new')}><Icon name="plus" size={18} /> New project</button>
			{#each projects.list as p (p.id)}
				<button class="choice" class:on={pick === p.id} onclick={() => (pick = p.id)}>
					<Icon name="folder" size={18} />
					<span class="cname">{p.name}</span>
					<small>{p.takeoffs.length}</small>
				</button>
			{/each}
		</div>
		{#if pick === 'new'}
			<input class="text" bind:value={projectName} placeholder="Project name, like Smith garage" autocomplete="off" />
		{/if}
		<button class="btn solid" onclick={save}>Save</button>
		<p class="fine">From then on, changes here are saved to the project as you make them.</p>
	</div>
</Sheet>

<Sheet bind:open={renameOpen} title="Rename takeoff">
	<div class="form">
		<input class="text" bind:value={rename} autocomplete="off" onkeydown={(e) => e.key === 'Enter' && doRename()} />
		<button class="btn solid" onclick={doRename}>Rename</button>
	</div>
</Sheet>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: -4px 0 10px;
	}
	.where {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 12px;
		background: var(--primary-soft);
		color: var(--primary-text);
		text-align: left;
	}
	.names {
		display: flex;
		gap: 6px;
		min-width: 0;
		font-weight: 600;
		font-size: 0.92rem;
	}
	.proj {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 50%;
		font-weight: 500;
	}
	.tk {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sep {
		opacity: 0.6;
	}
	.icon-btn.sm {
		width: 38px;
		height: 38px;
		color: var(--primary-text);
	}
	.btn.soft {
		background: var(--primary-soft);
		color: var(--primary-text);
		padding: 9px 14px;
		font-size: 0.92rem;
	}
	.save {
		flex: 1;
	}
	.saved {
		margin: -6px 4px 10px;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-bottom: 6px;
	}
	.lbl {
		font-size: 0.8rem;
		color: var(--muted);
		margin: 4px 2px -4px;
	}
	.choices {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 34dvh;
		overflow-y: auto;
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 12px;
		border-radius: 12px;
		background: var(--field);
		border: 1px solid var(--field-border);
		color: var(--text);
		text-align: left;
		font-weight: 600;
	}
	.choice.on {
		border-color: var(--primary);
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.cname {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.choice small {
		color: var(--muted);
	}
</style>
