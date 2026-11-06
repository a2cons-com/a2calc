#!/usr/bin/env node
// Uploads the iOS 27 product page creative assets (header, search results)
// to the app's Asset Library and places them on the iOS draft version.
// Replaces an existing placement of the same kind. Never submits.
//
//   node scripts/asc-creative.mjs --header <file> --search <file> [--dry-run]
//
// Images (.png/.jpg) go through appAssetLibraryImages, videos (.mp4/.mov)
// through appAssetLibraryVideos. Reads ASC_KEY_ID / ASC_ISSUER_ID /
// ASC_KEY_PATH (secrets/testflight.env).
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config/app.json'), 'utf8'));
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dryRun = args.includes('--dry-run');
const assets = [
	['PRODUCT_PAGE_HEADER_ASSET', option('--header')],
	['APP_STORE_SEARCH_RESULTS_ASSET', option('--search')]
].filter(([, file]) => file);
if (!assets.length) {
	console.error('usage: asc-creative.mjs --header <file> --search <file> [--dry-run]');
	process.exit(2);
}

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
const b64url = (buf) => Buffer.from(buf).toString('base64url');
function jwt() {
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
	const payload = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 10 * 60, aud: 'appstoreconnect-v1' }));
	const key = createPrivateKey(readFileSync(ASC_KEY_PATH.replace(/^\$HOME/, process.env.HOME ?? ''), 'utf8'));
	return `${header}.${payload}.${b64url(sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }))}`;
}
async function api(path, { method = 'GET', body } = {}) {
	if (method !== 'GET' && dryRun) {
		console.log(`    [dry-run] ${method} ${path}`);
		return { data: { id: 'dry', attributes: { uploadOperations: [], state: 'COMPLETE' } } };
	}
	const res = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
		method,
		headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	if (res.status === 204) return {};
	const json = await res.json();
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${json.errors?.map((e) => `${e.title}: ${e.detail}`).join('; ')}`);
	return json;
}
const step = (t) => console.log(`==> ${t}`);

const app = (await api(`/apps?filter[bundleId]=${cfg.appId}`)).data[0];
const library = (await api(`/apps/${app.id}/assetLibrary`)).data;
const draft = (await api(`/apps/${app.id}/appStoreVersions?filter[platform]=IOS`)).data.find((v) =>
	['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(v.attributes.appStoreState));
if (!draft) throw new Error('no iOS draft version');
const locs = (await api(`/appStoreVersions/${draft.id}/appStoreVersionLocalizations`)).data;

for (const [placementType, file] of assets) {
	const video = /\.(mp4|mov|m4v)$/i.test(file);
	const type = video ? 'appAssetLibraryVideos' : 'appAssetLibraryImages';
	const bytes = readFileSync(file);
	step(`${placementType}: uploading ${basename(file)} (${(bytes.length / 1e6).toFixed(1)} MB)`);
	const asset = (await api(`/${type}`, { method: 'POST', body: { data: { type,
		attributes: { category: 'CREATIVE_ASSETS', fileName: basename(file), fileSize: bytes.length },
		relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: library.id } } } } } })).data;
	for (const op of asset.attributes.uploadOperations ?? []) {
		const res = await fetch(op.url, { method: op.method,
			headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
			body: bytes.subarray(op.offset, op.offset + op.length) });
		if (!res.ok) throw new Error(`upload part failed: ${res.status}`);
	}
	await api(`/${type}/${asset.id}`, { method: 'PATCH', body: { data: { type, id: asset.id, attributes: { uploaded: true } } } });
	let state = 'AWAITING_UPLOAD';
	for (let i = 0; i < 120 && ['AWAITING_UPLOAD', 'UPLOAD_COMPLETE', 'PROCESSING'].includes(state); i++) {
		if (i) await new Promise((r) => setTimeout(r, 5000));
		state = dryRun ? 'COMPLETE' : (await api(`/${type}/${asset.id}`)).data.attributes.state;
	}
	console.log(`    state: ${state}`);
	if (state === 'FAILED') throw new Error(`${basename(file)} failed processing`);

	for (const loc of locs) {
		const existing = (await api(`/appStoreVersionLocalizations/${loc.id}/placements`)).data ?? [];
		for (const p of existing.filter((p) => p.attributes.placementType === placementType)) {
			await api(`/appAssetLibraryPlacements/${p.id}`, { method: 'DELETE' });
		}
		await api('/appAssetLibraryPlacements', { method: 'POST', body: { data: { type: 'appAssetLibraryPlacements',
			attributes: { placementType },
			relationships: {
				appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } },
				[video ? 'video' : 'image']: { data: { type, id: asset.id } } } } } });
		console.log(`    placed on ${loc.attributes.locale}`);
	}
}
console.log('done (preview it in App Store Connect: Header and Search Results > Preview)');
