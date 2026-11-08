<script lang="ts">
	import { p as pth } from '$lib/paths';
	// Projects: the list, and one project (?p=id) with its takeoffs.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ToolHead from '$lib/components/ToolHead.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import ExportSheet from '$lib/components/ExportSheet.svelte';
	import { prefs } from '$lib/stores/app.svelte';
	import { takeoffLine } from '$lib/export/report';
	import {
		addTakeoff,
		createProject,
		deleteProject,
		deleteTakeoff,
		duplicateProject,
		duplicateTakeoff,
		findProject,
		KIND_ICON,
		KIND_NAME,
		KINDS,
		openTakeoff,
		projects,
		type Takeoff,
		type TakeoffKind
	} from '$lib/stores/projects.svelte';

	const pid = $derived(Number(page.url.searchParams.get('p')) || 0);
	const project = $derived(pid ? findProject(pid) : undefined);

	let query = $state('');
	const shown = $derived(
		projects.list.filter((p) => !query.trim() || `${p.name} ${p.note}`.toLowerCase().includes(query.trim().toLowerCase()))
	);

	let newOpen = $state(false);
	let newName = $state('');
	let editOpen = $state(false);
	let editName = $state('');
	let editNote = $state('');
	let addOpen = $state(false);
	let exportOpen = $state(false);
	let confirmDelete = $state(false);
	let menuFor = $state<Takeoff | null>(null);
	let menuOpen = $state(false);
	let renameT = $state('');

	const when = (t: number) => {
		const d = new Date(t);
		const today = new Date();
		return d.toDateString() === today.toDateString()
			? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
			: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
	};

	function create() {
		const p = createProject(newName || 'Untitled project');
		newOpen = false;
		newName = '';
		goto(pth(`/projects?p=${p.id}`));
	}
	function saveEdit() {
		if (!project) return;
		project.name = editName.trim() || project.name;
		project.note = editNote;
		project.updated = Date.now();
		editOpen = false;
	}
	function open(t: Takeoff) {
		if (!project) return;
		const path = openTakeoff(project.id, t.id);
		if (path) goto(pth(path));
	}
	function add(kind: TakeoffKind) {
		if (!project) return;
		const t = addTakeoff(project.id, kind, 'new');
		addOpen = false;
		if (t) open(t);
	}
	function remove() {
		if (!project) return;
		deleteProject(project.id);
		confirmDelete = false;
		editOpen = false;
		goto(pth('/projects'));
	}
	function renameTakeoff() {
		if (menuFor && renameT.trim() && project) {
			menuFor.name = renameT.trim();
			project.updated = Date.now();
		}
		menuOpen = false;
	}
</script>

<svelte:head><title>{project ? project.name : 'Projects'} · A2 Calc</title></svelte:head>

<div class="page">
	{#if pid && !project}
		<ToolHead title="Projects" />
		<p class="fine">That project isn't here any more.</p>
		<a class="btn" href={pth('/projects')}>All projects</a>
	{:else if project}
		<ToolHead title="Project" back="/projects" />
		<button class="proj-head" onclick={() => ((editName = project.name), (editNote = project.note), (editOpen = true))}>
			<span class="pname">{project.name}</span>
			{#if project.note}<span class="pnote">{project.note}</span>{/if}
			<span class="fine">Changed {when(project.updated)} · tap to rename or add a note</span>
		</button>

		<div class="section-title">Takeoffs</div>
		{#if project.takeoffs.length}
			<div class="list">
				{#each project.takeoffs as t (t.id)}
					<div class="row">
						<button class="item" onclick={() => open(t)}>
							<span class="ico"><Icon name={KIND_ICON[t.kind]} size={22} /></span>
							<span class="txt">
								<b>{t.name}</b>
								<small>{KIND_NAME[t.kind]} · {takeoffLine(t, prefs.precision)}</small>
							</span>
							<Icon name="chevron" size={18} />
						</button>
						<button class="icon-btn more" aria-label="More for {t.name}" onclick={() => ((menuFor = t), (renameT = t.name), (menuOpen = true))}><Icon name="pencil" size={18} /></button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="fine empty">No takeoffs yet. Add one, or open any takeoff screen and use Save to project.</p>
		{/if}

		<div class="actions">
			<button class="btn solid" onclick={() => (addOpen = true)}><Icon name="plus" size={18} /> Add takeoff</button>
			<button class="btn" onclick={() => (exportOpen = true)} disabled={!project.takeoffs.length}><Icon name="share" size={18} /> Export</button>
		</div>
		<div class="actions minor">
			<button class="btn quiet" onclick={() => { const c = duplicateProject(project.id); if (c) goto(pth(`/projects?p=${c.id}`)); }}>Duplicate project</button>
			<button class="btn danger" onclick={() => (confirmDelete = true)}><Icon name="trash" size={16} /> Delete</button>
		</div>

		<ExportSheet bind:open={exportOpen} {project} takeoffs={project.takeoffs} />

		<Sheet bind:open={addOpen} title="Add a takeoff">
			<div class="kinds">
				{#each KINDS as k (k)}
					<button class="kind" onclick={() => add(k)}>
						<span class="ico big"><Icon name={KIND_ICON[k]} size={28} /></span>
						<span>{KIND_NAME[k]}</span>
					</button>
				{/each}
			</div>
		</Sheet>

		<Sheet bind:open={editOpen} title="Project">
			<div class="form">
				<input class="text" bind:value={editName} placeholder="Project name" autocomplete="off" />
				<textarea class="text" bind:value={editNote} placeholder="Note: address, client, anything (optional)"></textarea>
				<button class="btn solid" onclick={saveEdit}>Save</button>
			</div>
		</Sheet>

		<Sheet bind:open={confirmDelete} title="Delete this project?">
			<div class="form">
				<p class="fine">{project.name} and its {project.takeoffs.length} {project.takeoffs.length === 1 ? 'takeoff' : 'takeoffs'} will be gone from this device. This can't be undone.</p>
				<button class="btn solid del" onclick={remove}>Delete project</button>
				<button class="btn quiet" onclick={() => (confirmDelete = false)}>Keep it</button>
			</div>
		</Sheet>

		<Sheet bind:open={menuOpen} title={menuFor?.name ?? ''}>
			{#if menuFor}
				{@const t = menuFor}
				<div class="form">
					<input class="text" bind:value={renameT} autocomplete="off" onkeydown={(e) => e.key === 'Enter' && renameTakeoff()} />
					<button class="btn solid" onclick={renameTakeoff}>Rename</button>
					<button class="btn" onclick={() => { duplicateTakeoff(project.id, t.id); menuOpen = false; }}>Duplicate</button>
					<button class="btn danger" onclick={() => { deleteTakeoff(project.id, t.id); menuOpen = false; }}><Icon name="trash" size={16} /> Delete takeoff</button>
				</div>
			{/if}
		</Sheet>
	{:else}
		<ToolHead title="Projects" />
		{#if projects.list.length > 4}
			<input class="text search" type="search" bind:value={query} placeholder="Search projects" autocomplete="off" />
		{/if}
		<button class="btn solid new" onclick={() => (newOpen = true)}><Icon name="plus" size={18} /> New project</button>
		{#if shown.length}
			<div class="list">
				{#each shown as p (p.id)}
					<a class="item" href={pth(`/projects?p=${p.id}`)}>
						<span class="ico"><Icon name="folder" size={22} /></span>
						<span class="txt">
							<b>{p.name}</b>
							<small>{p.takeoffs.length} {p.takeoffs.length === 1 ? 'takeoff' : 'takeoffs'} · {when(p.updated)}</small>
						</span>
						<Icon name="chevron" size={18} />
					</a>
				{/each}
			</div>
		{:else if !projects.list.length}
			<div class="intro">
				<p>A project is a job: its stud walls, block walls and concrete pours together, saved on this device.</p>
				<p class="fine">Export a project as a PDF report or a spreadsheet to send or print.</p>
			</div>
		{/if}

		<Sheet bind:open={newOpen} title="New project">
			<div class="form">
				<input class="text" bind:value={newName} placeholder="Project name, like Smith garage" autocomplete="off" onkeydown={(e) => e.key === 'Enter' && create()} />
				<button class="btn solid" onclick={create}>Create</button>
			</div>
		</Sheet>
	{/if}
</div>

<style>
	.proj-head {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
		padding: 4px 2px 6px;
		color: var(--text);
		width: 100%;
	}
	.pname {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.2;
	}
	.pnote {
		color: var(--muted);
		white-space: pre-wrap;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.item {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--field);
		border: 1px solid var(--field-border);
		color: var(--text);
		text-decoration: none;
		text-align: left;
	}
	.ico {
		width: 42px;
		height: 42px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		background: var(--primary-soft);
		color: var(--primary-text);
		flex: none;
	}
	.ico.big {
		width: 56px;
		height: 56px;
		border-radius: 16px;
	}
	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.txt b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.txt small {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.more {
		color: var(--muted);
	}
	.actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}
	.actions .btn {
		flex: 1;
	}
	.actions.minor {
		margin-top: 6px;
	}
	.btn:disabled {
		opacity: 0.5;
	}
	.new {
		width: 100%;
		margin-bottom: 12px;
	}
	.search {
		margin-bottom: 10px;
	}
	.empty,
	.intro {
		margin: 6px 4px 0;
	}
	.intro p {
		margin: 0 0 8px;
	}
	.kinds {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		padding-bottom: 8px;
	}
	.kind {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 14px 6px;
		border-radius: 16px;
		background: var(--field);
		border: 1px solid var(--field-border);
		color: var(--text);
		font-weight: 600;
		font-size: 0.9rem;
		text-align: center;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-bottom: 6px;
	}
	.del {
		background: var(--danger);
	}
</style>
