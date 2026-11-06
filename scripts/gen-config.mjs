#!/usr/bin/env node
// Writes the app identity from config/app.json into the Xcode project
// (bundle ID, version, team) and Info.plist (home-screen name), so there is
// one place to change them. Run by every build script; safe to re-run.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'config/app.json'), 'utf8'));
for (const k of ['appId', 'appName', 'marketingVersion']) {
	if (!cfg[k]) {
		console.error(`config/app.json: "${k}" is required`);
		process.exit(1);
	}
}
if (!/^\d+\.\d+(\.\d+)?$/.test(cfg.marketingVersion)) {
	console.error(`config/app.json: marketingVersion "${cfg.marketingVersion}" must look like 1.2 or 1.2.3`);
	process.exit(1);
}
const team = process.env.DEVELOPMENT_TEAM || cfg.developmentTeam || '';

const pbx = join(root, 'ios/App/App.xcodeproj/project.pbxproj');
let p = readFileSync(pbx, 'utf8');
p = p.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${cfg.appId};`);
p = p.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${cfg.marketingVersion};`);
if (team) {
	if (/DEVELOPMENT_TEAM = /.test(p)) p = p.replace(/DEVELOPMENT_TEAM = [^;]*;/g, `DEVELOPMENT_TEAM = ${team};`);
	else p = p.replace(/(\t+)(CODE_SIGN_STYLE = Automatic;)/g, `$1$2\n$1DEVELOPMENT_TEAM = ${team};`);
}
writeFileSync(pbx, p);

const plistPath = join(root, 'ios/App/App/Info.plist');
let plist = readFileSync(plistPath, 'utf8');
plist = plist.replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${cfg.appName}$2`);
writeFileSync(plistPath, plist);

console.log(`ios project: ${cfg.appId} "${cfg.appName}" v${cfg.marketingVersion}${team ? `, team ${team}` : ''}`);
