// Export a project (or some of its takeoffs) as a PDF report or a CSV, and
// hand it over (share sheet, Save dialog or download).

import type { Project, Takeoff } from '$lib/stores/projects.svelte';
import { projectCsv } from './report';
import { fileName, shareFile } from './share';

export type ExportFormat = 'pdf' | 'csv';

export async function exportTakeoffs(p: Project, takeoffs: Takeoff[], format: ExportFormat, den: number) {
	const base = takeoffs.length === 1 && p.takeoffs.length !== 1 ? `${p.name} - ${takeoffs[0].name}` : p.name;
	if (format === 'csv') {
		return shareFile(fileName(base, 'csv'), 'text/csv', projectCsv(p, takeoffs, den));
	}
	const { projectPdf } = await import('./pdf');
	const bytes = await projectPdf(p, takeoffs, den);
	return shareFile(fileName(`${base} - takeoff`, 'pdf'), 'application/pdf', bytes);
}
