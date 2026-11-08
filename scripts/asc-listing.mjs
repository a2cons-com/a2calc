#!/usr/bin/env node
// Fills the App Store Connect record from docs/store-listing/listing.json
// and uploads docs/store-listing/screenshots/ (docs/store-listing/README.md).
// Edits only draft versions (PREPARE_FOR_SUBMISSION), for iOS and macOS;
// never submits for review.
//
//   node scripts/asc-listing.mjs [--version 0.2.0] [--build 52] [--mac-build 300]
//                                [--screenshots] [--platform IOS|MAC_OS] [--dry-run]
//
// --version      the App Store version (default: config/app.json's
//                marketingVersion); renames the draft version if needed
// --build        attach that processed iOS build to the iOS version
// --mac-build    the same for the macOS version
// --screenshots  replace the screenshots of each display type found in
//                docs/store-listing/screenshots/<type>/ (APP_DESKTOP goes to
//                the macOS version, the rest to iOS)
// REVIEW_CONTACT_FIRST / _LAST / _EMAIL / _PHONE (env, phone as +1 ...):
// App Review's contact; Apple requires it before submitting.
//
// Reads ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH (secrets/testflight.env).
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config/app.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dryRun = flag('--dry-run');
const listing = JSON.parse(readFileSync(join(ROOT, 'docs/store-listing/listing.json'), 'utf8'));
const version = option('--version') ?? cfg.marketingVersion;
const platforms = option('--platform') ? [option('--platform')] : ['IOS', 'MAC_OS'];
const SHOTS = join(ROOT, 'docs/store-listing/screenshots');
const shotPlatform = (type) => (type.startsWith('APP_DESKTOP') ? 'MAC_OS' : 'IOS');

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
	console.error('ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH are required (secrets/testflight.env)');
	process.exit(2);
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');
function jwt() {
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
	const payload = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 10 * 60, aud: 'appstoreconnect-v1' }));
	const key = createPrivateKey(readFileSync(ASC_KEY_PATH.replace(/^\$HOME/, process.env.HOME ?? ''), 'utf8'));
	const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
	return `${header}.${payload}.${b64url(sig)}`;
}

async function api(path, { method = 'GET', body } = {}) {
	if (method !== 'GET' && dryRun) {
		console.log(`    [dry-run] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 200) : '');
		return { data: body?.data ?? {} };
	}
	const url = path.startsWith('/v2/') ? `https://api.appstoreconnect.apple.com${path}` : `https://api.appstoreconnect.apple.com/v1${path}`;
	const res = await fetch(url, {
		method,
		headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	if (res.status === 204) return {};
	const json = await res.json();
	if (!res.ok) {
		const detail = json.errors?.map((e) => `${e.title}: ${e.detail}`).join('; ');
		throw new Error(`${method} ${path} -> ${res.status} ${detail}`);
	}
	return json;
}
const patch = (type, id, attributes, relationships) =>
	api(`/${type}/${id}`, { method: 'PATCH', body: { data: { type, id, attributes, relationships } } });
const step = (text) => console.log(`==> ${text}`);

const app = (await api(`/apps?filter[bundleId]=${cfg.appId}`)).data[0];
if (!app) throw new Error(`no app record for ${cfg.appId}`);

// App information (shared by iOS and macOS): subtitle, privacy policy,
// categories, age rating. Editable only while a version is being prepared.
const info = (await api(`/apps/${app.id}/appInfos`)).data.find((i) => i.attributes.state !== 'READY_FOR_DISTRIBUTION');
if (!info) step('app info and age rating: nothing editable, skipped');
else {
	const infoLoc = (await api(`/appInfos/${info.id}/appInfoLocalizations`)).data.find((l) => l.attributes.locale === listing.locale);
	step('app info: name, subtitle, privacy policy URL, categories');
	await patch('appInfoLocalizations', infoLoc.id, { name: listing.name, subtitle: listing.subtitle, privacyPolicyUrl: listing.privacyPolicyUrl });
	await patch('appInfos', info.id, undefined, {
		primaryCategory: { data: { type: 'appCategories', id: listing.primaryCategory } },
		secondaryCategory: { data: { type: 'appCategories', id: listing.secondaryCategory } }
	});
	step('age rating: no objectionable content (4+)');
	const age = (await api(`/appInfos/${info.id}/ageRatingDeclaration`)).data;
	const booleans = ['advertising', 'ageAssurance', 'gambling', 'healthOrWellnessTopics', 'lootBox', 'messagingAndChat',
		'parentalControls', 'socialMedia', 'socialMediaAgeRestricted', 'unrestrictedWebAccess', 'userGeneratedContent'];
	const ageAttributes = {};
	for (const [key, value] of Object.entries(age.attributes)) {
		if (/Override|kidsAgeBand|InfoUrl|gracRating/.test(key)) continue;
		ageAttributes[key] = booleans.includes(key) || typeof value === 'boolean' ? false : 'NONE';
	}
	await patch('ageRatingDeclarations', age.id, ageAttributes);
}

// Availability: every territory, and new ones as Apple adds them; only if
// it was never set.
const availability = await api(`/apps/${app.id}/appAvailabilityV2`).catch(() => null);
if (!availability?.data) {
	step('availability: all territories');
	const territories = (await api('/territories?limit=200')).data;
	await api('/v2/appAvailabilities', { method: 'POST', body: {
		data: { type: 'appAvailabilities', attributes: { availableInNewTerritories: true }, relationships: {
			app: { data: { type: 'apps', id: app.id } },
			territoryAvailabilities: { data: territories.map((t) => ({ type: 'territoryAvailabilities', id: `\${${t.id}}` })) } } },
		included: territories.map((t) => ({ type: 'territoryAvailabilities', id: `\${${t.id}}`, attributes: { available: true },
			relationships: { territory: { data: { type: 'territories', id: t.id } } } })) } })
		.catch((e) => console.log(`    could not set availability (${e.message.slice(0, 200)}): set it by hand`));
}

// Price: free, if no price was ever set (the schedule exists from the start,
// empty).
const schedule = await api(`/apps/${app.id}/appPriceSchedule`).catch(() => null);
const prices = schedule?.data ? await api(`/appPriceSchedules/${schedule.data.id}/manualPrices`).catch(() => null) : null;
if (!prices?.data?.length) {
	step('price: free (base territory USA)');
	const free = (await api(`/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200`)).data.find((p) => Number(p.attributes.customerPrice) === 0);
	if (!free) console.log('    no free price point found: set the price by hand');
	else
		await api('/appPriceSchedules', { method: 'POST', body: {
			data: { type: 'appPriceSchedules', relationships: {
				app: { data: { type: 'apps', id: app.id } },
				baseTerritory: { data: { type: 'territories', id: 'USA' } },
				manualPrices: { data: [{ type: 'appPrices', id: '${free}' }] } } },
			included: [{ type: 'appPrices', id: '${free}', attributes: { startDate: null },
				relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } } }] } })
			.catch((e) => console.log(`    could not set the price (${e.message.slice(0, 160)}): set it by hand`));
}

for (const platform of platforms) {
	const versions = (await api(`/apps/${app.id}/appStoreVersions?filter[platform]=${platform}`)).data;
	let draft = versions.find((v) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(v.attributes.appStoreState));
	if (!draft) {
		step(`${platform}: creating version ${version}`);
		draft = (await api('/appStoreVersions', { method: 'POST', body: { data: { type: 'appStoreVersions',
			attributes: { platform, versionString: version },
			relationships: { app: { data: { type: 'apps', id: app.id } } } } } })).data;
	}
	step(`${platform}: version ${draft.attributes?.versionString} -> ${version}, copyright, manual release`);
	await patch('appStoreVersions', draft.id, { versionString: version, copyright: listing.copyright, releaseType: 'AFTER_APPROVAL' });

	const versionLoc = (await api(`/appStoreVersions/${draft.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === listing.locale);
	step(`${platform}: description, keywords, promotional text, URLs`);
	const released = versions.some((v) => v.attributes.appStoreState === 'READY_FOR_SALE');
	await patch('appStoreVersionLocalizations', versionLoc.id, {
		description: listing.description,
		keywords: listing.keywords,
		promotionalText: listing.promotionalText,
		supportUrl: listing.supportUrl,
		marketingUrl: listing.marketingUrl,
		// "What's New": an update only (Apple refuses it on the first version).
		...(released && listing.whatsNew ? { whatsNew: listing.whatsNew } : {})
	});

	step(`${platform}: App Review notes`);
	const env = process.env;
	const review = {
		notes: listing.reviewNotes,
		demoAccountRequired: false,
		...(env.REVIEW_CONTACT_EMAIL ? { contactFirstName: env.REVIEW_CONTACT_FIRST, contactLastName: env.REVIEW_CONTACT_LAST,
			contactEmail: env.REVIEW_CONTACT_EMAIL, contactPhone: env.REVIEW_CONTACT_PHONE } : {})
	};
	const existing = await api(`/appStoreVersions/${draft.id}/appStoreReviewDetail`).catch(() => null);
	if (existing?.data) {
		if (existing.data.attributes.contactEmail || env.REVIEW_CONTACT_EMAIL) await patch('appStoreReviewDetails', existing.data.id, review);
		else console.log('    skipped: Apple takes them back only with the contact (REVIEW_CONTACT_FIRST / _LAST / _EMAIL / _PHONE)');
	} else {
		await api('/appStoreReviewDetails', { method: 'POST', body: { data: { type: 'appStoreReviewDetails', attributes: review,
			relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: draft.id } } } } } });
	}

	const buildNumber = option(platform === 'IOS' ? '--build' : '--mac-build');
	if (buildNumber) {
		const build = (await api(`/builds?filter[app]=${app.id}&filter[version]=${buildNumber}&filter[preReleaseVersion.version]=${version}&filter[preReleaseVersion.platform]=${platform}`)).data[0];
		if (!build) throw new Error(`${platform} build ${version} (${buildNumber}) not found`);
		if (build.attributes.processingState !== 'VALID') throw new Error(`build ${buildNumber} is ${build.attributes.processingState}, not VALID yet`);
		step(`${platform}: attaching build ${version} (${buildNumber})`);
		await api(`/appStoreVersions/${draft.id}/relationships/build`, { method: 'PATCH', body: { data: { type: 'builds', id: build.id } } });
	}

	if (flag('--screenshots')) {
		const sets = (await api(`/appStoreVersionLocalizations/${versionLoc.id}/appScreenshotSets`)).data;
		for (const displayType of readdirSync(SHOTS).filter((d) => statSync(join(SHOTS, d)).isDirectory() && shotPlatform(d) === platform)) {
			const files = readdirSync(join(SHOTS, displayType)).filter((f) => f.endsWith('.png')).sort();
			if (!files.length) continue;
			step(`${platform} ${displayType}: ${files.length} screenshots`);
			let set = sets.find((s) => s.attributes.screenshotDisplayType === displayType);
			if (set) for (const old of (await api(`/appScreenshotSets/${set.id}/appScreenshots`)).data) await api(`/appScreenshots/${old.id}`, { method: 'DELETE' });
			else
				set = (await api('/appScreenshotSets', { method: 'POST', body: { data: { type: 'appScreenshotSets',
					attributes: { screenshotDisplayType: displayType },
					relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: versionLoc.id } } } } } })).data;
			for (const file of files) {
				const bytes = readFileSync(join(SHOTS, displayType, file));
				const shot = (await api('/appScreenshots', { method: 'POST', body: { data: { type: 'appScreenshots',
					attributes: { fileName: file, fileSize: bytes.length },
					relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } } })).data;
				if (dryRun) continue;
				for (const op of shot.attributes.uploadOperations) {
					const res = await fetch(op.url, { method: op.method,
						headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
						body: bytes.subarray(op.offset, op.offset + op.length) });
					if (!res.ok) throw new Error(`upload of ${file} failed: ${res.status}`);
				}
				await patch('appScreenshots', shot.id, { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') });
				console.log(`    ${file}`);
			}
		}
	}
}

console.log(`done: ${platforms.join(' + ')} ${version} drafts filled. By hand in App Store Connect: App Privacy`);
console.log('("Data Not Collected"), the review contact if not set, then Add for Review.');
