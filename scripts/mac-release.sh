#!/usr/bin/env bash
# Build, sign and upload the macOS app to App Store Connect (TestFlight
# for Mac), unattended.
#
#   scripts/mac-release.sh               # full pipeline
#   scripts/mac-release.sh --skip-tests  # skip svelte-check + vitest
#   scripts/mac-release.sh --no-upload   # archive + export the .pkg only
#
# Uses config/app.json's version as it is (scripts/testflight.sh bumps it);
# the build number is the commit count. Signing: the Apple Distribution
# identity (DIST_CERT) with MAC_DIST_PROFILE for the app, and the Mac
# Installer Distribution identity (MAC_INSTALLER_CERT) for the package,
# both from secrets/testflight.env (scripts/asc-mac-signing.mjs sets them
# up).
. "$(dirname "$0")/lib.sh"
trap 'echo "mac-release.sh: stopped at line $LINENO (exit $?)" >&2' ERR

SKIP_TESTS=0; UPLOAD=1
for a in "$@"; do
  case "$a" in
    --skip-tests) SKIP_TESTS=1 ;;
    --no-upload) UPLOAD=0 ;;
    *) die "unknown option: $a" ;;
  esac
done

require_cmd node npm git xcodebuild xcodegen
load_secrets
TEAM="${DEVELOPMENT_TEAM:-$(app_config developmentTeam)}"
APP_ID="$(app_config appId)"
: "${MAC_DIST_PROFILE:?MAC_DIST_PROFILE is not set: run node scripts/asc-mac-signing.mjs}"
: "${MAC_INSTALLER_CERT:?MAC_INSTALLER_CERT is not set: run node scripts/asc-mac-signing.mjs}"
: "${ASC_KEY_ID:?}" "${ASC_ISSUER_ID:?}" "${ASC_KEY_PATH:?}"
AUTH_ARGS=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
[ "$UPLOAD" = 0 ] || node "$ROOT/scripts/asc-check.mjs" >/dev/null || die "App Store Connect preflight failed"

sign_keychain_begin

VERSION="$(app_config marketingVersion)"
BUILD="$(build_number)"
GIT_SHORT="$(git -C "$ROOT" rev-parse --short HEAD)"
log "A2 Calc for Mac $VERSION ($BUILD), commit $GIT_SHORT"

if [ "$SKIP_TESTS" = 0 ]; then
  log "type-check + unit tests"
  (cd "$ROOT" && npm run check && npm test)
fi

(cd "$ROOT" && npm run --silent config && npm run --silent build)
xcodegen generate --spec "$ROOT/macos/project.yml" --quiet

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$ARTIFACTS/Mac-$VERSION-$BUILD-$STAMP.xcarchive"
EXPORT_DIR="$ARTIFACTS/mac-export-$VERSION-$BUILD-$STAMP"
SIGN_ARGS=(CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="${DIST_CERT:-Apple Distribution}" PROVISIONING_PROFILE_SPECIFIER="$MAC_DIST_PROFILE")
[ -n "$SIGN_KEYCHAIN" ] && SIGN_ARGS+=(OTHER_CODE_SIGN_FLAGS="--keychain $SIGN_KEYCHAIN")

run_xcodebuild "$ARTIFACTS/mac-archive-$STAMP.log" \
  -project "$ROOT/macos/A2Calc.xcodeproj" -scheme A2Calc -configuration Release \
  -destination 'generic/platform=macOS' \
  -archivePath "$ARCHIVE" -derivedDataPath "$ARTIFACTS/MacDerivedData" \
  DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$BUILD" MARKETING_VERSION="$VERSION" \
  "${SIGN_ARGS[@]}" archive
log "archived $ARCHIVE"

DEST="export"; [ "$UPLOAD" = 1 ] && DEST="upload"
EXPORT_PLIST="$ARTIFACTS/MacExportOptions-$STAMP.plist"
cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key><string>app-store-connect</string>
	<key>destination</key><string>$DEST</string>
	<key>teamID</key><string>$TEAM</string>
	<key>signingStyle</key><string>manual</string>
	<key>signingCertificate</key><string>${DIST_CERT:-Apple Distribution}</string>
	<key>installerSigningCertificate</key><string>$MAC_INSTALLER_CERT</string>
	<key>provisioningProfiles</key><dict><key>$APP_ID</key><string>$MAC_DIST_PROFILE</string></dict>
	<key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

run_xcodebuild "$ARTIFACTS/mac-export-$STAMP.log" \
  -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_PLIST" -exportPath "$EXPORT_DIR" \
  "${AUTH_ARGS[@]}"

if [ "$UPLOAD" = 1 ]; then
  log "uploaded Mac $VERSION ($BUILD); it appears in TestFlight after Apple's processing"
  echo "mac $VERSION ($BUILD) $STAMP $GIT_SHORT" >> "$ARTIFACTS/uploads.log"
  NOTES_TMP="$(mktemp)"
  sed -e '/^<!--/,/-->$/d' "$ROOT/WHATS_NEW.md" | sed -e '/./,$!d' > "$NOTES_TMP"
  node "$ROOT/scripts/asc-whats-new.mjs" "$VERSION" "$BUILD" "commit $GIT_SHORT" "$NOTES_TMP" MAC_OS || warn "could not set the build's What to Test note"
  rm -f "$NOTES_TMP"
else
  log "exported to $EXPORT_DIR (no upload requested)"
fi
