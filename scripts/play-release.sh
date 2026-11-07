#!/usr/bin/env bash
# Build, sign and upload the Android app to Play's Internal testing track.
#
#   scripts/play-release.sh               # full pipeline
#   scripts/play-release.sh --skip-tests  # skip svelte-check + vitest
#   scripts/play-release.sh --no-upload   # build the signed .aab only
#   PLAY_TRACK=production scripts/play-release.sh   # straight to Production
#
# The version is config/app.json's marketingVersion (bump it with the iOS
# release, or by hand); the versionCode is the commit count. Signing uses
# android/keystore.properties (git-ignored); the upload uses the Play
# service-account key named by PLAY_KEY_PATH in secrets/play.env.
. "$(dirname "$0")/lib.sh"
trap 'echo "play-release.sh: stopped at line $LINENO (exit $?)" >&2' ERR

SKIP_TESTS=0; UPLOAD=1
for a in "$@"; do
  case "$a" in
    --skip-tests) SKIP_TESTS=1 ;;
    --no-upload) UPLOAD=0 ;;
    *) die "unknown option: $a" ;;
  esac
done

require_cmd node npm git python3
android_env
SECRETS_FILE="$ROOT/secrets/play.env" load_secrets
[ -f "$ROOT/android/keystore.properties" ] || die "android/keystore.properties is missing: release builds can't be signed"
if [ "$UPLOAD" = 1 ]; then
  : "${PLAY_KEY_PATH:?PLAY_KEY_PATH is not set (secrets/play.env)}"
  [ -f "$PLAY_KEY_PATH" ] || die "PLAY_KEY_PATH does not exist: $PLAY_KEY_PATH"
  NOTES_CHECK="$(sed -e '/^<!--/,/-->$/d' "$ROOT/WHATS_NEW.md" | grep -vE '^(What changed.*|What to check|-|[[:space:]]*|One-line summary of this build\.)$' || true)"
  [ -n "$NOTES_CHECK" ] || die "WHATS_NEW.md has no notes: write what changed first"
fi

if [ "$SKIP_TESTS" = 0 ]; then
  log "type-check + unit tests"
  (cd "$ROOT" && npm run check && npm test)
fi

build_web_android
log "gradle bundleRelease (log: artifacts/android-release.log)"
(cd "$ROOT/android" && ./gradlew --quiet bundleRelease > "$ARTIFACTS/android-release.log" 2>&1) || { tail -30 "$ARTIFACTS/android-release.log" >&2; die "release build failed"; }
AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
log "built ${AAB#$ROOT/} ($(app_config marketingVersion), versionCode $(sed -n 's/^versionCode=//p' "$ROOT/android/app/generated.properties"))"

if [ "$UPLOAD" = 1 ]; then
  PLAY_KEY_PATH="$PLAY_KEY_PATH" python3 "$ROOT/scripts/publish-play-release.py"
fi
