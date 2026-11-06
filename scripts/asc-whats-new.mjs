#!/usr/bin/env node
// Sets the TestFlight "What to Test" note of an uploaded build from
// WHATS_NEW.md (the label stands in when there are no notes).
// Usage: asc-whats-new.mjs <version> <build> <label> [notes-file]
// Reads ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH from the environment
// (scripts/testflight.sh loads secrets/testflight.env first). Waits for the
// build to appear in App Store Connect (processing can take minutes).
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [version, build, label, notesFile] = process.argv.slice(2);
let notes = '';
if (notesFile) {
	try {
		notes = readFileSync(notesFile, 'utf8').trim();
	} catch {
		notes = '';
	}
}
// App Store Connect refuses some symbols in What to Test ("Text for whatsNew
// contains invalid characters: '[✕]'"):
// ✕ / ✓ become X / check, other dingbats and emoji are dropped. ▸ and
// ⋯ are accepted. It also caps the text at 4000 characters.
const clean = (s) =>
	s
		.replace(/[✕✖✗✘]/g, 'X')
		.replace(/[✓✔]/g, 'check')
		.replace(/[\u2700-\u27BF\u{1F000}-\u{1FAFF}\uFE0F]/gu, '');
// The first line of the notes sums up the build: it opens the TestFlight
// email.
const text = clean(notes || label).slice(0, 4000);
const { ASC_KEY_ID: kid, ASC_ISSUER_ID: iss, ASC_KEY_PATH: keyPath } = process.env;
if (!kid || !iss || !keyPath) {
	console.error('ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH are required');
	process.exit(1);
}
const key = readFileSync(keyPath.replace(/^\$HOME/, process.env.HOME ?? ''), 'utf8');

function jwt() {
	const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const unsigned = `${b64({ alg: 'ES256', kid, typ: 'JWT' })}.${b64({ iss, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
	return `${unsigned}.${createSign('SHA256').update(unsigned).sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
async function api(path, init = {}) {
	const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, { ...init, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' } });
	const j = r.status === 204 ? {} : await r.json();
	if (j.errors) throw new Error(`${path}: ${JSON.stringify(j.errors[0]).slice(0, 300)}`);
	return j;
}

const bundleId = JSON.parse(readFileSync(new URL('../config/app.json', import.meta.url), 'utf8')).appId;
const app = (await api(`/v1/apps?filter[bundleId]=${bundleId}`)).data[0];
let found = null;
for (let i = 0; i < 40 && !found; i++) {
	const builds = await api(`/v1/builds?filter[app]=${app.id}&filter[version]=${build}&filter[preReleaseVersion.version]=${version}&limit=1`);
	found = builds.data?.[0] ?? null;
	if (!found) await new Promise((r) => setTimeout(r, 30_000));
}
if (!found) {
	console.error(`build ${version} (${build}) not visible in App Store Connect after 20 min`);
	process.exit(1);
}
const locs = await api(`/v1/builds/${found.id}/betaBuildLocalizations`);
const loc = locs.data?.find((l) => l.attributes.locale === 'en-US');
const attributes = { whatsNew: text };
if (loc) await api(`/v1/betaBuildLocalizations/${loc.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'betaBuildLocalizations', id: loc.id, attributes } }) });
else await api('/v1/betaBuildLocalizations', { method: 'POST', body: JSON.stringify({ data: { type: 'betaBuildLocalizations', attributes: { locale: 'en-US', ...attributes }, relationships: { build: { data: { type: 'builds', id: found.id } } } } }) });
console.log(`What to Test for ${version} (${build}): ${label}${notes ? ` + ${notes.split('\n').length} lines of notes` : ''}`);
