#!/usr/bin/env node
// Preflight for TestFlight uploads: verifies the App Store Connect API key
// works and that an app record exists for our bundle ID — the two things
// that otherwise fail only after a 10-minute archive. No fastlane needed:
// the ASC API just wants an ES256 JWT, which Node's crypto can sign.
//
//   ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=... node scripts/asc-check.mjs
//
// Exit codes: 0 ok, 2 missing config, 3 key rejected, 4 app record missing.
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'config/app.json'), 'utf8'));
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;

if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
	console.error('missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH (see secrets.env.example and APPLE_SETUP_REQUIRED.md)');
	process.exit(2);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
function makeJwt() {
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
	const payload = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 10 * 60, aud: 'appstoreconnect-v1' }));
	const key = createPrivateKey(readFileSync(ASC_KEY_PATH, 'utf8'));
	const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
	return `${header}.${payload}.${b64url(sig)}`;
}

async function api(path) {
	const res = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
		headers: { Authorization: `Bearer ${makeJwt()}` }
	});
	const body = await res.json().catch(() => ({}));
	return { status: res.status, body };
}

const apps = await api(`/apps?filter[bundleId]=${encodeURIComponent(cfg.appId)}`);
if (apps.status === 401) {
	console.error(`App Store Connect rejected the API key (401): ${JSON.stringify(apps.body.errors?.[0]?.detail ?? apps.body)}`);
	process.exit(3);
}
if (apps.status !== 200) {
	console.error(`unexpected ${apps.status} from App Store Connect: ${JSON.stringify(apps.body).slice(0, 400)}`);
	process.exit(3);
}
const app = apps.body.data?.[0];
if (!app) {
	console.error(`API key OK, but no App Store Connect app record exists for bundle ID ${cfg.appId}. Create it (APPLE_SETUP_REQUIRED.md, step "App record").`);
	process.exit(4);
}
console.log(`ok: API key valid; app "${app.attributes.name}" (${app.attributes.bundleId}, sku ${app.attributes.sku}) found`);

const builds = await api(`/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=1`);
const latest = builds.body.data?.[0];
if (latest) {
	console.log(`latest uploaded build: ${latest.attributes.version} (${latest.attributes.processingState}, ${latest.attributes.uploadedDate})`);
	if (process.argv.includes('--print-latest-build')) process.stdout.write(`LATEST_BUILD=${latest.attributes.version}\n`);
} else {
	console.log('no builds uploaded yet');
}
