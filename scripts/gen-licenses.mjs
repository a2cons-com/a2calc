#!/usr/bin/env node
// Writes src/lib/licenses.json: the license of every open-source package
// that ships inside the app (the web bundle and the native shells), read
// from node_modules, for the About screen. Run by scripts/gen-config.mjs,
// so every build carries the current versions and texts.
//
// Build tools (Vite, TypeScript, svelte-check, ...) don't ship and aren't
// listed. Add a package here when the app starts importing it.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED = [
	'svelte',
	'@sveltejs/kit',
	'devalue',
	'esm-env',
	'clsx',
	'three',
	'@capacitor/core',
	'@capacitor/ios',
	'@capacitor/android',
	'@capacitor/clipboard',
	'@capacitor/haptics',
	'@capacitor/splash-screen',
	'@capacitor/status-bar',
	'@capacitor/filesystem',
	'@capacitor/share',
	'jspdf'
];

const out = SHIPPED.map((name) => {
	const dir = join(root, 'node_modules', name);
	const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	const file = readdirSync(dir).find((f) => /^licen[cs]e(\.md|\.txt)?$/i.test(f));
	if (!file) throw new Error(`${name}: no license file`);
	const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '';
	const url = repo.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, '').replace(/^([\w.-]+\/[\w.-]+)$/, 'https://github.com/$1');
	return { name, version: pkg.version, license: pkg.license, url: url || pkg.homepage || '', text: readFileSync(join(dir, file), 'utf8').trim() };
});
const target = join(root, 'src/lib/licenses.json');
const json = JSON.stringify(out, null, '\t') + '\n';
if (!existsSync(target) || readFileSync(target, 'utf8') !== json) writeFileSync(target, json);
console.log(`licenses: ${out.length} packages (${[...new Set(out.map((p) => p.license))].join(', ')})`);
