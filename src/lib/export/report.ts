// What a takeoff says, as data: the headline, the summary lines, tables
// (cut list, what to buy, pieces) and notes. The PDF and the CSV export are
// both drawn from it, so they say the same as the screens.

import { formatFtIn, formatNumber } from '$lib/calc/units';
import type { ConcreteData, GroutData } from '$lib/stores/app.svelte';
import type { Project, Takeoff } from '$lib/stores/projects.svelte';
import { KIND_NAME } from '$lib/stores/projects.svelte';
import { bags80, concreteOrder, pieceIn3, PIECE_FIELDS, PIECE_NAMES } from '$lib/takeoff/concrete';
import { frameWall, type WallInput } from '$lib/takeoff/framing';
import { groutVolume, wallTotals } from '$lib/takeoff/grout';

export interface Table {
	title: string;
	note?: string;
	cols: string[];
	/** Columns from this index on are numbers (right-aligned). */
	numFrom: number;
	rows: string[][];
}

export interface Report {
	kind: Takeoff['kind'];
	kindName: string;
	name: string;
	headline: { label: string; value: string; unit: string };
	summary: [string, string][];
	tables: Table[];
	warnings: string[];
	notes: string[];
}

const ROLE_NAME: Record<string, string> = {
	stud: 'Studs', corner: 'Corner backers', king: 'King studs', jack: 'Jack studs', cripple: 'Cripples',
	header: 'Header plies', sill: 'Sills', 'top plate': 'Top plate', 'bottom plate': 'Bottom plate'
};

/** 5.25 -> "5¼" (concrete and grout are ordered by the quarter yard). */
export function quarters(v: number): string {
	const whole = Math.floor(v);
	const fr = ['', '¼', '½', '¾'][Math.round((v - whole) * 4)];
	return whole || !fr ? `${whole}${fr}` : fr;
}

const yd = (v: number) => formatNumber(v, 2);
const walls = (n: number) => `${n} ${n === 1 ? 'wall' : 'walls'}`;

function framing(w: WallInput, den: number): Omit<Report, 'kind' | 'kindName' | 'name'> {
	const ft = (v: number) => formatFtIn(v, den);
	const r = frameWall(w);
	const total = w.runs.reduce((s, x) => s + x.length, 0);
	const verticals = r.cuts.filter((c) => ['stud', 'corner', 'king'].includes(c.role)).reduce((s, c) => s + c.count, 0);
	const openings = w.runs.reduce((s, x) => s + x.openings.length, 0);
	const summary: [string, string][] = [
		['Wall length', `${ft(total)} · ${walls(w.runs.length)}`],
		['Wall height', ft(w.height)],
		['Framing', `${w.member} at ${w.spacing}″ o.c.`],
		['Plates', `${w.topPlates === 2 ? 'Double' : 'Single'} top, ${w.bottomPlates === 2 ? 'double' : 'single'} bottom · ${formatNumber(r.plateLf, 1)} lf`],
		['Stud cut length', ft(r.studLength)],
		['Openings', String(openings)]
	];
	if (r.corners) summary.push(['Corners', String(r.corners)]);
	const wallRows = w.runs.map((run, i) => [
		`Wall ${i + 1}`,
		ft(run.length),
		run.openings.map((o) => `${o.kind === 'door' ? 'Door' : 'Window'} ${ft(o.width)} × ${ft(o.height)}`).join(', ') || '—'
	]);
	return {
		headline: { label: 'Full-height studs', value: String(verticals), unit: 'pcs' },
		summary,
		tables: [
			{ title: 'Walls', cols: ['Wall', 'Length', 'Openings (rough opening)'], numFrom: 99, rows: wallRows },
			{
				title: 'Cut list',
				cols: ['Piece', 'Size', 'Length', 'Qty'],
				numFrom: 2,
				rows: r.cuts.map((c) => [ROLE_NAME[c.role] ?? c.role, c.size, ft(c.length), String(c.count)])
			},
			{
				title: 'To buy',
				note: `+${w.wastePct}% waste`,
				cols: ['Size', 'Length', 'Qty'],
				numFrom: 1,
				rows: r.buy.map((b) => [b.size, b.precut ? `${ft(b.precut)} precut` : `${b.feet}′`, String(b.count)])
			}
		],
		warnings: r.warnings,
		notes: [
			"Studs on layout from each wall's start with an end stud at both ends, one backer per corner, one king and one jack each side of an opening, headers as plies to fill the wall.",
			'Size headers from the plans or span tables; this does not check spans or loads. Blocking, fire blocking and sheathing are not included.'
		]
	};
}

function blockGrout(g: GroutData, den: number): Omit<Report, 'kind' | 'kindName' | 'name'> {
	const ft = (v: number) => formatFtIn(v, den);
	const r = groutVolume(g);
	const totals = wallTotals(g.runs, g.closed, g.heightIn);
	const summary: [string, string][] = [
		['Grout', `${formatNumber(r.netFt3, 1)} cu ft`],
		[`Waste ${g.wastePct}%`, `${formatNumber(r.wasteFt3, 1)} cu ft`]
	];
	if (g.pumpYd3 > 0) summary.push(['Pump and hose', `${yd(g.pumpYd3)} yd`]);
	summary.push(['Total', `${yd(r.totalYd3)} yd`]);
	if (r.lintels && g.lintel === 'poured') summary.push([`Poured lintels (${r.lintels}), concrete`, `${formatNumber(r.pouredFt3, 1)} cu ft · ${yd(r.pouredFt3 / 27)} yd`]);
	if (r.lintels && g.lintel !== 'poured') summary.push([`Lintels (${r.lintels}), in the grout`, `${formatNumber(r.lintelFt3, 1)} cu ft`]);
	if (r.cells !== null) summary.push(['Cells grouted', String(r.cells)]);
	summary.push(
		['Blocks (no waste)', r.blocks.toLocaleString('en-US')],
		['Block', `${g.width}″ CMU · ${g.spacingIn ? `cells at ${g.spacingIn}″ o.c.` : 'solid grouted'}`],
		['Wall height', ft(g.heightIn)],
		['Wall length', `${ft(totals.lengthIn)} · ${walls(g.runs.length)}`]
	);
	if (totals.corners) summary.push(['Corners', String(totals.corners)]);
	if (totals.openingsSf > 0) summary.push(['Openings', `${formatNumber(totals.openingsSf, 1)} sq ft`]);
	return {
		headline: { label: 'Grout to order', value: quarters(r.orderYd3), unit: 'cu yd' },
		summary,
		tables: [
			{
				title: 'Walls',
				cols: ['Wall', 'Length', 'Openings'],
				numFrom: 99,
				rows: g.runs.map((run, i) => [`Wall ${i + 1}`, ft(run.length), run.openings.map((o) => `${ft(o.width)} × ${ft(o.height)}`).join(', ') || '—'])
			}
		],
		warnings: [],
		notes: [
			'Grout volumes from Table 3 of CMHA TEK 4-2A (hollow two-core block, every cell filled), counted cell by cell for partial grouting; waste on top.',
			'Rebar and bond beams other than lintels are not included.'
		]
	};
}

function concreteReport(c: ConcreteData, den: number): Omit<Report, 'kind' | 'kindName' | 'name'> {
	const ft = (v: number) => formatFtIn(v, den);
	const r = concreteOrder(c.pieces, c.wastePct, c.pumpYd3);
	const summary: [string, string][] = [
		['Neat volume', `${formatNumber(r.netIn3 / 1728, 1)} cu ft · ${yd(r.netYd3)} yd`],
		[`Waste ${c.wastePct}%`, `${yd(r.wasteYd3)} yd`]
	];
	if (r.pumpYd3 > 0) summary.push(['Pump and line', `${yd(r.pumpYd3)} yd`]);
	summary.push(['Total', `${yd(r.totalYd3)} yd`]);
	if (r.netYd3 < 1 && r.netIn3 > 0) summary.push(['Or premix (80 lb bags)', `${bags80(r.netIn3 * (1 + c.wastePct / 100))} bags`]);
	const dims = (p: (typeof c.pieces)[number]) => {
		const [la, lb, lc] = PIECE_FIELDS[p.kind];
		const parts = [`${la} ${ft(p.a)}`, `${lb} ${ft(p.b)}`];
		if (lc) parts.push(`${lc} ${ft(p.c)}`);
		return parts.join(' · ');
	};
	return {
		headline: { label: 'Concrete to order', value: quarters(r.orderYd3), unit: 'cu yd' },
		summary,
		tables: [
			{
				title: 'Pieces',
				cols: ['Piece', 'Size', 'Qty', 'cu ft', 'cu yd'],
				numFrom: 2,
				rows: c.pieces.map((p) => [PIECE_NAMES[p.kind], dims(p), String(p.count), formatNumber(pieceIn3(p) / 1728, 1), yd(pieceIn3(p) / 46656)])
			}
		],
		warnings: [],
		notes: ['Ordered to the next quarter yard. Volumes are neat dimensions: overdig, sloped subgrade and form bulge add to them.']
	};
}

export function takeoffReport(t: Takeoff, den: number): Report {
	const body =
		t.kind === 'framing' ? framing(t.data as WallInput, den) : t.kind === 'grout' ? blockGrout(t.data as GroutData, den) : concreteReport(t.data as ConcreteData, den);
	return { kind: t.kind, kindName: KIND_NAME[t.kind], name: t.name, ...body };
}

/** One line for lists: "20 studs" / "1¼ cu yd grout" / "5¼ cu yd". */
export function takeoffLine(t: Takeoff, den: number): string {
	try {
		const h = takeoffReport(t, den).headline;
		return t.kind === 'framing' ? `${h.value} studs` : `${h.value} ${h.unit}`;
	} catch {
		return '';
	}
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Every takeoff's lines, one row each, for a spreadsheet. */
export function projectCsv(p: Project, takeoffs: Takeoff[], den: number): string {
	const rows: string[][] = [['Project', 'Takeoff', 'Type', 'Section', 'Item', 'Detail', 'Value']];
	for (const t of takeoffs) {
		const r = takeoffReport(t, den);
		const base = [p.name, r.name, r.kindName];
		rows.push([...base, 'Total', r.headline.label, '', `${r.headline.value} ${r.headline.unit}`]);
		for (const [k, v] of r.summary) rows.push([...base, 'Summary', k, '', v]);
		for (const tb of r.tables) {
			for (const row of tb.rows) {
				const value = row[row.length - 1];
				const item = row[0];
				const detail = row.slice(1, -1).join(' · ');
				rows.push([...base, tb.note ? `${tb.title} (${tb.note})` : tb.title, item, detail, value]);
			}
		}
	}
	// Excel reads a UTF-8 CSV right when it starts with a byte-order mark.
	return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
