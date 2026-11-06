#!/usr/bin/env bash
# Shared helpers for the build scripts. Source this; don't run it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XCODEPROJ="$ROOT/ios/App/App.xcodeproj"
SCHEME="App"
ARTIFACTS="$ROOT/artifacts"
DERIVED_DATA="$ARTIFACTS/DerivedData"
SECRETS_FILE="${SECRETS_FILE:-$ROOT/secrets/testflight.env}"

mkdir -p "$ARTIFACTS"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "'$c' is required but not installed"
  done
}

# secrets/testflight.env (git-ignored; see secrets.env.example). Every value
# can also come from the environment.
load_secrets() {
  if [ -f "$SECRETS_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$SECRETS_FILE"
    set +a
  fi
}

app_config() {
  node -e "const c=require('$ROOT/config/app.json'); const v=c['$1']; process.stdout.write(v==null?'':String(v))"
}

# xcodebuild with the full log in a file; on failure, the useful lines.
run_xcodebuild() {
  local logfile="$1"; shift
  log "xcodebuild $* (log: ${logfile#$ROOT/})"
  if xcodebuild "$@" > "$logfile" 2>&1; then
    return 0
  fi
  echo "----- xcodebuild failed; relevant output -----" >&2
  grep -E "error:|error =|fatal|Provisioning|No profiles|No signing|requires a development team|Code Signing|xcodebuild: error|ARCHIVE FAILED|EXPORT FAILED|BUILD FAILED" "$logfile" | sort -u | head -40 >&2 || true
  echo "----- full log: $logfile -----" >&2
  return 1
}

# Build number: BUILD_NUMBER wins, else the commit count (grows with every
# commit on a linear history).
build_number() {
  if [ -n "${BUILD_NUMBER:-}" ]; then echo "$BUILD_NUMBER"; else git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1; fi
}

preflight_toolchain() {
  require_cmd node npm xcodebuild xcrun git
  [ -d "$ROOT/node_modules" ] || { log "node_modules missing; running npm install"; (cd "$ROOT" && npm install --no-audit --no-fund); }
}

# Web bundle + Capacitor sync into the iOS project.
build_web() {
  (cd "$ROOT" && npm run --silent config && npm run --silent build && npx cap sync ios)
}
