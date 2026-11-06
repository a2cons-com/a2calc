#!/usr/bin/env bash
# Build, sign and upload the app to TestFlight, unattended.
#
#   scripts/testflight.sh                # full pipeline
#   scripts/testflight.sh --skip-tests   # skip svelte-check + vitest
#   scripts/testflight.sh --no-upload    # archive + export the .ipa only
#   scripts/testflight.sh --check        # only verify the API key and app record
#   scripts/testflight.sh --no-bump      # keep config/app.json's version
#
# Every upload is its own iteration: the patch number of marketingVersion in
# config/app.json goes up by one (0.1.0 -> 0.1.1) and is committed before
# the archive; the build number is the commit count.
#
# Inputs come from secrets/testflight.env (git-ignored; see
# secrets.env.example) or the environment. Signing is manual with an App
# Store profile (scripts/asc-profiles.mjs) and the Apple Distribution
# identity, optionally from its own keychain (SIGN_KEYCHAIN, with its
# password in the variable named by SIGN_KEYCHAIN_PASSWORD_VAR).
. "$(dirname "$0")/lib.sh"
trap 'echo "testflight.sh: stopped at line $LINENO (exit $?)" >&2' ERR

SKIP_TESTS=0; UPLOAD=1; CHECK_ONLY=0; BUMP=1
for a in "$@"; do
  case "$a" in
    --skip-tests) SKIP_TESTS=1 ;;
    --no-upload) UPLOAD=0 ;;
    --no-bump) BUMP=0 ;;
    --check) CHECK_ONLY=1 ;;
    *) die "unknown option: $a" ;;
  esac
done

preflight_toolchain
load_secrets

TEAM="${DEVELOPMENT_TEAM:-$(app_config developmentTeam)}"
APP_ID="$(app_config appId)"
APP_NAME="$(app_config appName)"
[ -n "$TEAM" ] || die "no team: set developmentTeam in config/app.json or DEVELOPMENT_TEAM"
export DEVELOPMENT_TEAM="$TEAM"

: "${ASC_KEY_ID:?ASC_KEY_ID is not set (secrets/testflight.env)}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID is not set (secrets/testflight.env)}"
: "${ASC_KEY_PATH:?ASC_KEY_PATH is not set (secrets/testflight.env)}"
[ -f "$ASC_KEY_PATH" ] || die "ASC_KEY_PATH does not exist: $ASC_KEY_PATH"
log "checking the App Store Connect key and app record"
node "$ROOT/scripts/asc-check.mjs" || die "App Store Connect preflight failed (see above)"
AUTH_ARGS=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
[ "$CHECK_ONLY" = 1 ] && { log "credentials OK"; exit 0; }
: "${DIST_PROFILE:?DIST_PROFILE is not set: run node scripts/asc-profiles.mjs and add its line to secrets/testflight.env}"

# The signing keychain goes first in the search list for the run; the list
# is restored and the keychain locked again on exit.
if [ -n "${SIGN_KEYCHAIN:-}" ] && [ -f "$SIGN_KEYCHAIN" ]; then
  PASS_VAR="${SIGN_KEYCHAIN_PASSWORD_VAR:-}"
  [ -n "$PASS_VAR" ] && [ -n "${!PASS_VAR:-}" ] || die "SIGN_KEYCHAIN is set but its password variable (\$SIGN_KEYCHAIN_PASSWORD_VAR) is empty"
  security unlock-keychain -p "${!PASS_VAR}" "$SIGN_KEYCHAIN" || die "could not unlock $SIGN_KEYCHAIN"
  ORIGINAL_KEYCHAINS=()
  while IFS= read -r line; do
    line="${line#"${line%%[![:space:]]*}"}"; line="${line%\"}"; line="${line#\"}"
    [ -n "$line" ] && [ "$line" != "$SIGN_KEYCHAIN" ] && ORIGINAL_KEYCHAINS+=("$line")
  done < <(security list-keychains -d user)
  security list-keychains -d user -s "$SIGN_KEYCHAIN" "${ORIGINAL_KEYCHAINS[@]}"
  restore_keychains() {
    security list-keychains -d user -s "${ORIGINAL_KEYCHAINS[@]}" "$SIGN_KEYCHAIN"
    security lock-keychain "$SIGN_KEYCHAIN" 2>/dev/null || true
  }
  trap restore_keychains EXIT
  log "signing from $(basename "$SIGN_KEYCHAIN")"
else
  SIGN_KEYCHAIN=""
fi

if [ "$UPLOAD" = 1 ] && [ "$BUMP" = 1 ]; then
  [ -z "$(git -C "$ROOT" status --porcelain)" ] || die "working tree is dirty; commit first (the version bump is committed on its own)"
  CURRENT="$(app_config marketingVersion)"
  NEXT="$(printf '%s' "$CURRENT" | awk -F. '{ if (NF < 3) $3 = 0; $3 = $3 + 1; print $1 "." $2 "." $3 }')"
  node -e '
    const fs = require("fs"); const p = process.argv[1];
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/("marketingVersion":\s*")[^"]*(")/, `$1${process.argv[2]}$2`));
  ' "$ROOT/config/app.json" "$NEXT"
  (cd "$ROOT" && npm run --silent config >/dev/null)
  git -C "$ROOT" add config/app.json ios/App/App.xcodeproj/project.pbxproj
  git -C "$ROOT" commit -q -m "Version $NEXT" -m "marketingVersion $CURRENT -> $NEXT for this TestFlight upload."
  log "version $CURRENT -> $NEXT (committed)"
fi

VERSION="$(app_config marketingVersion)"
BUILD="$(build_number)"
GIT_SHORT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
if [ "$UPLOAD" = 1 ]; then
  NOTES_CHECK="$(sed -e '/^<!--/,/-->$/d' "$ROOT/WHATS_NEW.md" | grep -vE '^(What changed.*|What to check|-|[[:space:]]*|One-line summary of this build\.)$' || true)"
  [ -n "$NOTES_CHECK" ] || die "WHATS_NEW.md has no notes: write what changed first"
  ! grep -q '^One-line summary of this build\.$' "$ROOT/WHATS_NEW.md" || die "WHATS_NEW.md: replace the placeholder first line with a one-sentence summary"
fi
log "$APP_NAME $VERSION ($BUILD), commit $GIT_SHORT, team $TEAM"

if [ "$SKIP_TESTS" = 0 ]; then
  log "type-check + unit tests"
  (cd "$ROOT" && npm run check && npm test)
fi

build_web

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$ARTIFACTS/App-$VERSION-$BUILD-$STAMP.xcarchive"
EXPORT_DIR="$ARTIFACTS/export-$VERSION-$BUILD-$STAMP"
SIGN_ARGS=(CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="${DIST_CERT:-Apple Distribution}" PROVISIONING_PROFILE_SPECIFIER="$DIST_PROFILE")
[ -n "$SIGN_KEYCHAIN" ] && SIGN_ARGS+=(OTHER_CODE_SIGN_FLAGS="--keychain $SIGN_KEYCHAIN")

run_xcodebuild "$ARTIFACTS/archive-$STAMP.log" \
  -project "$XCODEPROJ" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -derivedDataPath "$DERIVED_DATA" \
  -skipPackagePluginValidation -skipMacroValidation \
  DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$BUILD" MARKETING_VERSION="$VERSION" \
  "${SIGN_ARGS[@]}" \
  archive
log "archived $ARCHIVE"

DEST="export"; [ "$UPLOAD" = 1 ] && DEST="upload"
EXPORT_PLIST="$ARTIFACTS/ExportOptions-$STAMP.plist"
sed -e "s/__TEAM_ID__/$TEAM/" -e "s/__DESTINATION__/$DEST/" -e "s/__APP_ID__/$APP_ID/" -e "s/__DIST_PROFILE__/$DIST_PROFILE/" -e "s/__DIST_CERT__/${DIST_CERT:-Apple Distribution}/" \
  "$ROOT/scripts/ExportOptions.plist.template" > "$EXPORT_PLIST"

run_xcodebuild "$ARTIFACTS/export-$STAMP.log" \
  -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_PLIST" -exportPath "$EXPORT_DIR" \
  "${AUTH_ARGS[@]}"

if [ "$UPLOAD" = 1 ]; then
  log "uploaded $VERSION ($BUILD); it appears in TestFlight after Apple's processing (usually 5-15 min)"
  echo "$VERSION ($BUILD) $STAMP $GIT_SHORT" >> "$ARTIFACTS/uploads.log"
  # WHATS_NEW.md is the build's "What to Test"; afterwards it is archived
  # to docs/testflight-history.md and reset to the template.
  NOTES="$ROOT/WHATS_NEW.md"
  NOTES_BODY="$(sed -e '/^<!--/,/-->$/d' "$NOTES" | sed -e '/./,$!d')"
  NOTES_TMP="$(mktemp)"
  printf '%s\n' "$NOTES_BODY" > "$NOTES_TMP"
  node "$ROOT/scripts/asc-whats-new.mjs" "$VERSION" "$BUILD" "commit $GIT_SHORT" "$NOTES_TMP" || warn "could not set the build's What to Test note"
  rm -f "$NOTES_TMP"
  mkdir -p "$ROOT/docs"
  { printf '\n## %s (%s), %s\n\n' "$VERSION" "$BUILD" "$(date +%Y-%m-%d)"; printf '%s\n' "$NOTES_BODY"; } >> "$ROOT/docs/testflight-history.md"
  cat > "$NOTES" <<'TEMPLATE'
<!-- The next build's "What to Test", in plain words. First line: one
     sentence summing up the build (it opens the TestFlight email). Then what
     changed and what to check. scripts/testflight.sh sends it, archives it
     to docs/testflight-history.md and resets this file. -->

One-line summary of this build.

What changed

-

What to check

-
TEMPLATE
  log "What to Test archived to docs/testflight-history.md; WHATS_NEW.md reset (commit both)"
else
  log "exported IPA to $EXPORT_DIR (no upload requested)"
fi
