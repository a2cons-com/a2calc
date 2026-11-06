#!/usr/bin/env node
// Mac App Store signing, through the App Store Connect API:
//   1. a Mac Installer Distribution certificate (signs the .pkg that is
//      uploaded), created from a fresh private key when none exists; the
//      key and certificate go into SIGN_KEYCHAIN
//   2. a MAC_APP_STORE provisioning profile for the app, installed locally
// The app itself is signed with the existing Apple Distribution
// certificate (DIST_CERT). Prints the lines for secrets/testflight.env.
//
//   set -a; . secrets/testflight.env; set +a; node scripts/asc-mac-signing.mjs
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'config/app.json'), 'utf8'));
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, DIST_CERT, SIGN_KEYCHAIN, SIGN_KEYCHAIN_PASSWORD_VAR } = process.env;
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
const sha1 = (b64) => createHash('sha1').update(Buffer.from(b64, 'base64')).digest('hex').toUpperCase();
const live = (c) => new Date(c.attributes.expirationDate) > new Date();

// 1. Installer certificate
const installers = (await api('GET', '/certificates?filter[certificateType]=MAC_INSTALLER_DISTRIBUTION&limit=200')).data.filter(live);
let installer = installers[0];
if (!installer) {
	if (!SIGN_KEYCHAIN || !SIGN_KEYCHAIN_PASSWORD_VAR || !process.env[SIGN_KEYCHAIN_PASSWORD_VAR]) {
		console.error('creating the installer certificate needs SIGN_KEYCHAIN and its password variable, to keep the private key');
		process.exit(2);
	}
	const dir = mkdtempSync(join(tmpdir(), 'a2calc-installer-'));
	try {
		const key = join(dir, 'installer.key');
		const csr = join(dir, 'installer.csr');
		execFileSync('openssl', ['genrsa', '-out', key, '2048'], { stdio: 'ignore' });
		execFileSync('openssl', ['req', '-new', '-key', key, '-out', csr, '-subj', '/CN=A2 Labs Mac Installer/O=A2 Labs/C=US'], { stdio: 'ignore' });
		const csrContent = readFileSync(csr, 'utf8');
		console.log('creating a Mac Installer Distribution certificate');
		installer = (await api('POST', '/certificates', { data: { type: 'certificates', attributes: { certificateType: 'MAC_INSTALLER_DISTRIBUTION', csrContent } } })).data;
		const cer = join(dir, 'installer.cer');
		writeFileSync(cer, Buffer.from(installer.attributes.certificateContent, 'base64'));
		const pass = process.env[SIGN_KEYCHAIN_PASSWORD_VAR];
		execFileSync('security', ['unlock-keychain', '-p', pass, SIGN_KEYCHAIN]);
		execFileSync('security', ['import', key, '-k', SIGN_KEYCHAIN, '-T', '/usr/bin/productbuild', '-T', '/usr/bin/codesign', '-T', '/usr/bin/xcodebuild']);
		execFileSync('security', ['import', cer, '-k', SIGN_KEYCHAIN]);
		execFileSync('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', pass, SIGN_KEYCHAIN], { stdio: 'ignore' });
		execFileSync('security', ['lock-keychain', SIGN_KEYCHAIN]);
		console.log(`installed the installer key and certificate in ${SIGN_KEYCHAIN.split('/').pop()}`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
const installerSha = sha1(installer.attributes.certificateContent);

// 2. Mac App Store profile, signed by the Apple Distribution certificate
const bundle = (await api('GET', `/bundleIds?filter[identifier]=${encodeURIComponent(cfg.appId)}&limit=200`)).data.find((b) => b.attributes.identifier === cfg.appId);
if (!bundle) throw new Error(`bundle ID ${cfg.appId} is not registered`);
const dists = (await api('GET', '/certificates?filter[certificateType]=DISTRIBUTION&limit=200')).data.filter(live);
const dist = (DIST_CERT && dists.find((c) => sha1(c.attributes.certificateContent) === DIST_CERT.toUpperCase())) || dists[0];
if (!dist) throw new Error('no valid Apple Distribution certificate');
const name = `${cfg.appName} Mac App Store`;
for (const p of (await api('GET', `/profiles?filter[name]=${encodeURIComponent(name)}&limit=200`)).data.filter((p) => p.attributes.name === name)) {
	console.log(`removing old profile ${name}`);
	await api('DELETE', `/profiles/${p.id}`);
}
const profile = (
	await api('POST', '/profiles', {
		data: {
			type: 'profiles',
			attributes: { name, profileType: 'MAC_APP_STORE' },
			relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } }, certificates: { data: [{ type: 'certificates', id: dist.id }] } }
		}
	})
).data;
const pdir = join(homedir(), 'Library/MobileDevice/Provisioning Profiles');
mkdirSync(pdir, { recursive: true });
writeFileSync(join(pdir, `${profile.attributes.uuid}.provisionprofile`), Buffer.from(profile.attributes.profileContent, 'base64'));
console.log(`installed ${name}\n\nsecrets/testflight.env:\nMAC_DIST_PROFILE="${name}"\nMAC_INSTALLER_CERT=${installerSha}`);
