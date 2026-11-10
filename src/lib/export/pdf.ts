// The takeoff report as a PDF, made on the device (jsPDF, no server): the
// project, then each takeoff with its total, summary, drawings (the same
// plan and wall drawings as the screens, in light colors) and tables.

import { mount, unmount, flushSync, type Component } from 'svelte';
import type { jsPDF as JsPDF } from 'jspdf';
import iconSvg from '$lib/assets/app-icon.svg?raw';
import type { ConcreteData, GroutData } from '$lib/stores/app.svelte';
import type { Project, Takeoff } from '$lib/stores/projects.svelte';
import { frameWall, LUMBER, type WallInput } from '$lib/takeoff/framing';
import { actualWidth, wallsGrout } from '$lib/takeoff/grout';
import { planWalls } from '$lib/takeoff/plan';
import { takeoffReport, type Report, type Table } from './report';
import FloorPlan from '$lib/components/FloorPlan.svelte';
import WallElevation from '$lib/components/WallElevation.svelte';
import BlockElevation from '$lib/components/BlockElevation.svelte';
import ConcreteSketch from '$lib/components/ConcreteSketch.svelte';
import StairSection from '$lib/components/StairSection.svelte';
import StairPlan from '$lib/components/StairPlan.svelte';
import StairStringer from '$lib/components/StairStringer.svelte';
import { stairRuns, stairs, type StairInput } from '$lib/takeoff/stairs';

// Letter, in points.
const W = 612;
const H = 792;
const M = 44;
const CW = W - 2 * M;
const GREEN: [number, number, number] = [0, 104, 57];
const INK: [number, number, number] = [17, 28, 22];
const MUTED: [number, number, number] = [93, 109, 101];
const LINE: [number, number, number] = [221, 229, 224];

/** The built-in PDF fonts know Latin-1 only: primes, thirds and the like
 *  become plain characters. */
function pdfText(s: string): string {
	const FR: Record<string, string> = { '⅛': ' 1/8', '⅜': ' 3/8', '⅝': ' 5/8', '⅞': ' 7/8', '⅓': ' 1/3', '⅔': ' 2/3' };
	return s
		.replace(/[′’]/g, "'")
		.replace(/[″”“]/g, '"')
		.replace(/[−–—]/g, '-')
		.replace(/⁄/g, '/')
		.replace(/[⅛⅜⅝⅞⅓⅔]/g, (c) => FR[c])
		.replace(/ | /g, ' ')
		.replace(/[^\x00-\xff]/g, '');
}

interface Drawing {
	title: string;
	png: string;
	w: number;
	h: number;
}

const COPY = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'paint-order', 'visibility', 'display'];

/** Draw a Svelte drawing component off screen in light colors, and turn its
 *  SVG into a PNG (styles inlined, since CSS variables don't travel). */
async function renderDrawing<P extends Record<string, unknown>>(comp: Component<P>, props: P, title: string, px = 1600): Promise<Drawing | null> {
	const host = document.createElement('div');
	host.className = 'theme-light';
	host.style.cssText = 'position:fixed;left:-20000px;top:0;width:700px;background:#fff;color:#111c16';
	document.body.appendChild(host);
	let inst: ReturnType<typeof mount> | null = null;
	try {
		inst = mount(comp, { target: host, props });
		flushSync();
		const svg = host.querySelector('svg');
		if (!svg) return null;
		const clone = svg.cloneNode(true) as SVGSVGElement;
		const src = [svg, ...svg.querySelectorAll('*')];
		const dst = [clone, ...clone.querySelectorAll('*')];
		src.forEach((el, i) => {
			const cs = getComputedStyle(el);
			const d = dst[i] as SVGElement;
			d.setAttribute('style', COPY.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';'));
			d.removeAttribute('class');
		});
		const vb = svg.viewBox.baseVal;
		const ratio = vb && vb.width ? vb.height / vb.width : 0.6;
		const w = px;
		const h = Math.round(px * ratio);
		clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		clone.setAttribute('width', String(w));
		clone.setAttribute('height', String(h));
		clone.style.minWidth = '';
		const png = await svgToPng(new XMLSerializer().serializeToString(clone), w, h);
		return { title, png, w, h };
	} catch {
		return null;
	} finally {
		if (inst) unmount(inst);
		host.remove();
	}
}

function svgToPng(svg: string, w: number, h: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const c = document.createElement('canvas');
			c.width = w;
			c.height = h;
			const ctx = c.getContext('2d')!;
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, w, h);
			ctx.drawImage(img, 0, 0, w, h);
			resolve(c.toDataURL('image/png'));
		};
		img.onerror = () => reject(new Error('drawing'));
		img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
	});
}

async function drawings(t: Takeoff): Promise<Drawing[]> {
	const out: (Drawing | null)[] = [];
	if (t.kind === 'framing') {
		const w = t.data as WallInput;
		const r = frameWall(w);
		const plan = planWalls(w.runs, LUMBER[w.member]?.[1] ?? 3.5, w.closed);
		if (w.runs.length > 1) out.push(await renderDrawing(FloorPlan, { plan, height: w.height, selected: -1 }, 'Plan', 1400));
		for (let i = 0; i < r.runs.length; i++) out.push(await renderDrawing(WallElevation, { rf: r.runs[i], height: w.height }, `Wall ${i + 1}`));
	} else if (t.kind === 'grout') {
		const g = t.data as GroutData;
		const plan = planWalls(g.runs, actualWidth(g.width), g.closed);
		const grid = wallsGrout(g.runs, g.closed, g.heightIn, g.spacingIn, g.cellsPerCorner, g.lintel);
		if (g.runs.length > 1) out.push(await renderDrawing(FloorPlan, { plan, height: g.heightIn, selected: -1, material: 'block' }, 'Plan', 1400));
		for (let i = 0; i < plan.walls.length; i++) {
			if (!grid[i]) continue;
			out.push(await renderDrawing(BlockElevation, { wall: plan.walls[i], height: g.heightIn, spacingIn: g.spacingIn, grout: grid[i], poured: g.lintel === 'poured' }, `Wall ${i + 1}`));
		}
	} else if (t.kind === 'stairs') {
		const s = t.data as StairInput;
		const r = stairs(s);
		if (r.turns) {
			const runs = stairRuns(r);
			for (const [k, part] of runs.entries()) out.push(await renderDrawing(StairSection, { input: s, r, part }, `Section, run ${k + 1} of ${runs.length}`, 1600));
		} else out.push(await renderDrawing(StairSection, { input: s, r }, 'Section', 1600));
		out.push(await renderDrawing(StairPlan, { input: s, r }, 'Plan', 1400));
		for (let i = 0; i < r.flights.length; i++) {
			if (r.flights[i].risers < 2) continue;
			out.push(await renderDrawing(StairStringer, { input: s, r, flight: i }, r.flights.length > 1 ? `Stringer, flight ${i + 1}` : 'Stringer', 1400));
		}
	} else {
		const c = t.data as ConcreteData;
		for (const p of c.pieces) out.push(await renderDrawing(ConcreteSketch, { piece: p }, '', 900));
	}
	return out.filter((d): d is Drawing => !!d);
}

class Writer {
	y = M;
	constructor(public doc: JsPDF) {}
	ensure(h: number) {
		if (this.y + h > H - M - 18) {
			this.doc.addPage();
			this.y = M;
		}
	}
	text(s: string, x: number, y: number, opts?: Parameters<JsPDF['text']>[3]) {
		this.doc.text(pdfText(s), x, y, opts);
	}
	color(c: [number, number, number]) {
		this.doc.setTextColor(...c);
	}
	font(size: number, style: 'normal' | 'bold' = 'normal') {
		this.doc.setFont('helvetica', style);
		this.doc.setFontSize(size);
	}
	/** Wrapped lines of `s` at `width`. */
	lines(s: string, width: number): string[] {
		return this.doc.splitTextToSize(pdfText(s), width) as string[];
	}
	para(s: string, size = 8.5, color = MUTED) {
		this.font(size);
		this.color(color);
		const ls = this.lines(s, CW);
		this.ensure(ls.length * size * 1.3 + 4);
		this.doc.text(ls, M, this.y + size);
		this.y += ls.length * size * 1.3 + 4;
	}
	heading(s: string) {
		this.ensure(30);
		this.font(9, 'bold');
		this.color(MUTED);
		this.text(s.toUpperCase(), M, this.y + 9, { charSpace: 0.6 });
		this.y += 16;
	}
}

function headline(wr: Writer, r: Report) {
	const { doc } = wr;
	wr.ensure(64);
	doc.setFillColor(...GREEN);
	doc.roundedRect(M, wr.y, CW, 54, 8, 8, 'F');
	wr.color([255, 255, 255]);
	wr.font(11, 'bold');
	wr.text(r.headline.label, M + 16, wr.y + 32);
	wr.font(12, 'bold');
	const unitW = doc.getTextWidth(pdfText(r.headline.unit));
	wr.text(r.headline.unit, M + CW - 16, wr.y + 35, { align: 'right' });
	wr.font(26, 'bold');
	wr.text(r.headline.value, M + CW - 16 - unitW - 6, wr.y + 36, { align: 'right' });
	wr.y += 66;
}

function summary(wr: Writer, rows: [string, string][]) {
	const { doc } = wr;
	for (const [k, v] of rows) {
		wr.font(10);
		const vl = wr.lines(v, CW * 0.55);
		const h = Math.max(1, vl.length) * 13 + 5;
		wr.ensure(h);
		wr.color(MUTED);
		wr.text(k, M, wr.y + 11);
		wr.color(INK);
		wr.font(10, 'bold');
		doc.text(vl, M + CW, wr.y + 11, { align: 'right' });
		doc.setDrawColor(...LINE);
		doc.setLineWidth(0.5);
		doc.line(M, wr.y + h - 1, M + CW, wr.y + h - 1);
		wr.y += h;
	}
	wr.y += 10;
}

function table(wr: Writer, t: Table) {
	const { doc } = wr;
	wr.ensure(70); // the heading, the column names and a row together
	wr.heading(t.note ? `${t.title}  ·  ${t.note}` : t.title);
	const n = t.cols.length;
	// Number columns as wide as their longest entry; text columns share the rest.
	wr.font(9.5);
	const numW = t.cols.map((c, i) => (i >= t.numFrom ? Math.max(44, ...[c, ...t.rows.map((r) => r[i] ?? '')].map((x) => doc.getTextWidth(pdfText(x)) + 14)) : 0));
	const nums = numW.reduce((a, b) => a + b, 0);
	const textCols = t.cols.filter((_, i) => i < t.numFrom).length;
	const textW = (CW - nums) / Math.max(1, textCols);
	const widths = t.cols.map((_, i) => (i >= t.numFrom ? numW[i] : textW));
	const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0));
	const row = (cells: string[], head: boolean) => {
		wr.font(head ? 8 : 9.5, head ? 'bold' : 'normal');
		const wrapped = cells.map((c, i) => wr.lines(c, widths[i] - 10));
		const h = Math.max(...wrapped.map((l) => l.length)) * (head ? 10 : 12) + 8;
		wr.ensure(h);
		if (head) {
			doc.setFillColor(237, 242, 239);
			doc.rect(M, wr.y, CW, h, 'F');
		}
		wr.color(head ? MUTED : INK);
		wrapped.forEach((l, i) => {
			const right = i >= t.numFrom;
			doc.text(l, right ? xs[i] + widths[i] - 5 : xs[i] + 5, wr.y + (head ? 12 : 13), right ? { align: 'right' } : undefined);
		});
		doc.setDrawColor(...LINE);
		doc.setLineWidth(0.5);
		doc.line(M, wr.y + h, M + CW, wr.y + h);
		wr.y += h;
	};
	row(t.cols, true);
	for (const r of t.rows) row(r, false);
	wr.y += 14;
}

function drawing(wr: Writer, d: Drawing, maxH = 300) {
	let w = CW;
	let h = (d.h / d.w) * w;
	if (h > maxH) {
		h = maxH;
		w = (d.w / d.h) * h;
	}
	wr.ensure(h + (d.title ? 16 : 0) + 8);
	if (d.title) {
		wr.font(9, 'bold');
		wr.color(MUTED);
		wr.text(d.title, M, wr.y + 9);
		wr.y += 14;
	}
	wr.doc.addImage(d.png, 'PNG', M + (CW - w) / 2, wr.y, w, h, undefined, 'FAST');
	wr.y += h + 12;
}

async function takeoffSection(wr: Writer, t: Takeoff, den: number) {
	const r = takeoffReport(t, den);
	wr.ensure(80);
	wr.font(9, 'bold');
	wr.color(GREEN);
	wr.text(r.kindName.toUpperCase(), M, wr.y + 9, { charSpace: 0.6 });
	wr.font(17, 'bold');
	wr.color(INK);
	wr.text(r.name, M, wr.y + 30);
	wr.y += 42;
	headline(wr, r);
	summary(wr, r.summary);
	for (const w of r.warnings) wr.para(`! ${w}`, 9, [122, 83, 0]);
	const ds = await drawings(t);
	if (ds.length) {
		// Keep the heading with the first drawing.
		const d0 = ds[0];
		wr.ensure(Math.min((d0.h / d0.w) * CW, t.kind === 'concrete' ? 150 : 260) + 50);
		wr.heading('Drawings');
		const small = t.kind === 'concrete';
		for (const d of ds) drawing(wr, d, small ? 150 : 260);
	}
	for (const tb of r.tables) table(wr, tb);
	for (const n of r.notes) wr.para(n);
}

/** The report for a project (all its takeoffs, or the ones given). */
export async function projectPdf(p: Project, takeoffs: Takeoff[], den: number): Promise<Uint8Array> {
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
	doc.setProperties({ title: `${p.name} · takeoff report`, creator: 'A2 Calc (calc.a2cons.com)' });
	const wr = new Writer(doc);

	// Header: mark, project, date.
	try {
		const icon = await svgToPng(iconSvg, 192, 192);
		doc.addImage(icon, 'PNG', M, M, 30, 30);
	} catch {
		/* no mark */
	}
	wr.font(9, 'bold');
	wr.color(GREEN);
	wr.text('A2 CALC  ·  TAKEOFF REPORT', M + 40, M + 12, { charSpace: 0.6 });
	wr.font(9);
	wr.color(MUTED);
	wr.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), M + 40, M + 26);
	wr.y = M + 50;
	wr.font(22, 'bold');
	wr.color(INK);
	for (const l of wr.lines(p.name, CW)) {
		doc.text(l, M, wr.y + 20);
		wr.y += 26;
	}
	if (p.note.trim()) wr.para(p.note, 10.5, MUTED);
	wr.y += 4;

	// Contents, when there is more than one takeoff.
	if (takeoffs.length > 1) {
		const rows: [string, string][] = takeoffs.map((t) => {
			const r = takeoffReport(t, den);
			return [`${r.name}  (${r.kindName})`, `${r.headline.value} ${r.headline.unit}`];
		});
		wr.heading('In this report');
		summary(wr, rows);
	}

	// The first takeoff follows on the first page; each next one starts a page.
	for (let i = 0; i < takeoffs.length; i++) {
		if (i > 0) {
			doc.addPage();
			wr.y = M;
		} else wr.y += 8;
		await takeoffSection(wr, takeoffs[i], den);
	}

	// Footer on every page.
	const pages = doc.getNumberOfPages();
	for (let i = 1; i <= pages; i++) {
		doc.setPage(i);
		wr.font(7.5);
		wr.color(MUTED);
		wr.text('Estimates only: check every quantity against the plans and with your supplier before you order.  ·  calc.a2cons.com', M, H - M + 14);
		wr.text(`${i} / ${pages}`, W - M, H - M + 14, { align: 'right' });
	}
	return new Uint8Array(doc.output('arraybuffer'));
}
