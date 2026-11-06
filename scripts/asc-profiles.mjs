#!/usr/bin/env node
// Issues (or re-issues) the App Store provisioning profile for the app
// through the App Store Connect API and installs it on this Mac. The
// TestFlight export signs manually with it (scripts/testflight.sh).
//
//   set -a; . secrets/testflight.env; set +a; node scripts/asc-profiles.mjs
//
// Registers the bundle ID first if it is missing. Prints the DIST_PROFILE
// line for secrets/testflight.env.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createPrivateKey, sign, createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'config/app.json'), 'utf8'));
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, DIST_CERT } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
	console.error('missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH (secrets/testflight.env)');
	process.exit(2);
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');
function jwt() {
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
	const payload = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
	const key = createPrivateKey(readFileSync(ASC_KEY_PATH, 'utf8'));
	return `${header}.${payload}.${b64url(sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }))}`;
}
async function api(method, path, body) {
	const res = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
		method,
		headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
	return json;
}
async function bundleId(identifier, name) {
	const found = (await api('GET', `/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=200`)).data.find((b) => b.attributes.identifier === identifier);
	if (found) return found;
	console.log(`registering bundle ID ${identifier}`);
	return (await api('POST', '/bundleIds', { data: { type: 'bundleIds', attributes: { identifier, name, platform: 'IOS' } } })).data;
}
async function distributionCertificate() {
	const certs = (await api('GET', '/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200')).data;
	const live = certs.filter((c) => new Date(c.attributes.expirationDate) > new Date());
	if (DIST_CERT) {
		const match = live.find((c) => createHash('sha1').update(Buffer.from(c.attributes.certificateContent, 'base64')).digest('hex').toUpperCase() === DIST_CERT.toUpperCase());
		if (match) return match;
		console.warn(`no distribution certificate with SHA-1 ${DIST_CERT}; using the newest one`);
	}
	if (!live.length) throw new Error('no valid Apple Distribution certificate on the team');
	return live.sort((a, b) => b.attributes.expirationDate.localeCompare(a.attributes.expirationDate))[0];
}
const name = `${cfg.appName} App Store`;
const app = await bundleId(cfg.appId, cfg.appName);
const cert = await distributionCertificate();
for (const p of (await api('GET', `/profiles?filter[name]=${encodeURIComponent(name)}&limit=200`)).data.filter((p) => p.attributes.name === name)) {
	console.log(`removing old profile ${name} (${p.attributes.uuid})`);
	await api('DELETE', `/profiles/${p.id}`);
}
const created = (
	await api('POST', '/profiles', {
		data: {
			type: 'profiles',
			attributes: { name, profileType: 'IOS_APP_STORE' },
			relationships: { bundleId: { data: { type: 'bundleIds', id: app.id } }, certificates: { data: [{ type: 'certificates', id: cert.id }] } }
		}
	})
).data;
const dir = join(homedir(), 'Library/MobileDevice/Provisioning Profiles');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${created.attributes.uuid}.mobileprovision`);
writeFileSync(file, Buffer.from(created.attributes.profileContent, 'base64'));
console.log(`installed ${name} -> ${file}\n\nsecrets/testflight.env:\nDIST_PROFILE="${name}"`);
