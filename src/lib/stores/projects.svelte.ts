// Projects: a job (name, note) holding any number of named takeoffs, kept on
// the device. A takeoff screen edits the scratch store for its kind
// (stores/app); opening a project's takeoff copies it in and links the two,
// and every change is saved back into the project while the link stays.

import { concrete, CONCRETE_DEFAULT, floor, FLOOR_DEFAULT, walltile, WALLTILE_DEFAULT, grout, GROUT_DEFAULT, newId, stairs, STAIRS_DEFAULT, wall, WALL_DEFAULT } from './app.svelte';
import { persisted } from './persist.svelte';

export type TakeoffKind = 'framing' | 'grout' | 'concrete' | 'stairs' | 'flooring' | 'walltile';

export interface Takeoff {
	id: number;
	kind: TakeoffKind;
	name: string;
	/** The takeoff's inputs, the same shape as its screen's store. */
	data: unknown;
	updated: number;
}

export interface Project {
	id: number;
	name: string;
	note: string;
	created: number;
	updated: number;
	takeoffs: Takeoff[];
}

export const KIND_NAME: Record<TakeoffKind, string> = { framing: 'Stud wall', grout: 'Block fill grout', concrete: 'Concrete', stairs: 'Stairs', flooring: 'Flooring', walltile: 'Wall tile' };
export const KIND_ICON: Record<TakeoffKind, string> = { framing: 'studs', grout: 'brick', concrete: 'slab', stairs: 'stairs', flooring: 'floor', walltile: 'walltile' };
export const KIND_PATH: Record<TakeoffKind, string> = { framing: '/takeoff/framing', grout: '/takeoff/grout', concrete: '/takeoff/concrete', stairs: '/takeoff/stairs', flooring: '/takeoff/flooring', walltile: '/takeoff/wall-tile' };
export const KINDS: TakeoffKind[] = ['framing', 'grout', 'concrete', 'stairs', 'flooring', 'walltile'];

const STORE: Record<TakeoffKind, object> = { framing: wall, grout, concrete, stairs, flooring: floor, walltile };
const DEFAULT: Record<TakeoffKind, object> = { framing: WALL_DEFAULT, grout: GROUT_DEFAULT, concrete: CONCRETE_DEFAULT, stairs: STAIRS_DEFAULT, flooring: FLOOR_DEFAULT, walltile: WALLTILE_DEFAULT };

export const projects = persisted('projects', { list: [] as Project[] });

/** The project takeoff each screen is editing, if any. */
export const editing = persisted('editing', { framing: null, grout: null, concrete: null, stairs: null, flooring: null, walltile: null } as Record<TakeoffKind, { p: number; t: number } | null>);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const findProject = (id: number) => projects.list.find((p) => p.id === id);

export function findTakeoff(link: { p: number; t: number } | null) {
	if (!link) return null;
	const project = findProject(link.p);
	const takeoff = project?.takeoffs.find((t) => t.id === link.t);
	return project && takeoff ? { project, takeoff } : null;
}

export function createProject(name: string, note = ''): Project {
	const now = Date.now();
	const p: Project = { id: newId(), name: name.trim() || 'Untitled project', note, created: now, updated: now, takeoffs: [] };
	projects.list.unshift(p);
	return projects.list[0];
}

export function deleteProject(id: number) {
	const i = projects.list.findIndex((p) => p.id === id);
	if (i >= 0) projects.list.splice(i, 1);
	for (const k of KINDS) if (editing[k]?.p === id) editing[k] = null;
}

export function duplicateProject(id: number): Project | undefined {
	const src = findProject(id);
	if (!src) return;
	const now = Date.now();
	const copy: Project = { ...clone(src), id: newId(), name: `${src.name} copy`, created: now, updated: now };
	copy.takeoffs = copy.takeoffs.map((t) => ({ ...t, id: newId() }));
	projects.list.unshift(copy);
	return projects.list[0];
}

/** A unique default name: "Stud wall", "Stud wall 2", ... */
function nextName(p: Project, kind: TakeoffKind): string {
	const base = KIND_NAME[kind];
	const taken = new Set(p.takeoffs.map((t) => t.name));
	if (!taken.has(base)) return base;
	let n = 2;
	while (taken.has(`${base} ${n}`)) n++;
	return `${base} ${n}`;
}

/** Add a takeoff to a project: a new one, or what the screen shows now. */
export function addTakeoff(projectId: number, kind: TakeoffKind, from: 'new' | 'screen', name?: string): Takeoff | undefined {
	const p = findProject(projectId);
	if (!p) return;
	const data = clone(from === 'screen' ? $state.snapshot(STORE[kind]) : DEFAULT[kind]);
	const t: Takeoff = { id: newId(), kind, name: name?.trim() || nextName(p, kind), data, updated: Date.now() };
	p.takeoffs.push(t);
	p.updated = t.updated;
	return p.takeoffs[p.takeoffs.length - 1];
}

export function deleteTakeoff(projectId: number, takeoffId: number) {
	const p = findProject(projectId);
	if (!p) return;
	const i = p.takeoffs.findIndex((t) => t.id === takeoffId);
	if (i >= 0) p.takeoffs.splice(i, 1);
	p.updated = Date.now();
	for (const k of KINDS) if (editing[k]?.t === takeoffId) editing[k] = null;
}

export function duplicateTakeoff(projectId: number, takeoffId: number) {
	const p = findProject(projectId);
	const t = p?.takeoffs.find((x) => x.id === takeoffId);
	if (!p || !t) return;
	const i = p.takeoffs.indexOf(t);
	p.takeoffs.splice(i + 1, 0, { ...clone($state.snapshot(t)), id: newId(), name: `${t.name} copy`, updated: Date.now() });
	p.updated = Date.now();
}

/** Put a project's takeoff on its screen and link them (autosave). */
export function openTakeoff(projectId: number, takeoffId: number): string | null {
	const found = findTakeoff({ p: projectId, t: takeoffId });
	if (!found) return null;
	const { takeoff } = found;
	const store = STORE[takeoff.kind] as Record<string, unknown>;
	const data = clone(takeoff.data) as Record<string, unknown>;
	// Defaults first, so a takeoff saved by an older version gets new fields.
	Object.assign(store, clone(DEFAULT[takeoff.kind]), data);
	editing[takeoff.kind] = { p: projectId, t: takeoffId };
	return KIND_PATH[takeoff.kind];
}

/** Unlink a screen from its project takeoff (it keeps the values). */
export const closeTakeoff = (kind: TakeoffKind) => (editing[kind] = null);

/** Save to project: copy the screen into a project as a new takeoff, linked. */
export function saveScreen(kind: TakeoffKind, projectId: number, name: string) {
	const t = addTakeoff(projectId, kind, 'screen', name);
	if (t) editing[kind] = { p: projectId, t: t.id };
}

/** Keep linked takeoffs saved: call once, from the layout. */
export function autosave() {
	for (const kind of KINDS) {
		$effect(() => {
			const link = editing[kind];
			const json = JSON.stringify(STORE[kind]);
			if (!link) return;
			const found = findTakeoff(link);
			if (!found) {
				editing[kind] = null;
				return;
			}
			if (JSON.stringify(found.takeoff.data) === json) return;
			found.takeoff.data = JSON.parse(json);
			found.takeoff.updated = found.project.updated = Date.now();
		});
	}
}
