#!/usr/bin/env bash
# Build for the iOS Simulator and (optionally) install + launch it.
#
#   scripts/build-sim.sh            # build only
#   scripts/build-sim.sh --run      # build, boot the simulator, install, launch
#   SIM_NAME="iPad Air 11-inch (M3)" scripts/build-sim.sh --run
#
# No Apple account needed: simulator builds sign to run locally.
. "$(dirname "$0")/lib.sh"

RUN=0
for a in "$@"; do
  case "$a" in
    --run) RUN=1 ;;
    --skip-web) SKIP_WEB=1 ;;
    *) die "unknown option: $a" ;;
  esac
done
SIM_NAME="${SIM_NAME:-iPhone 17 Pro}"
# By id: a bare name means "on the newest runtime", which may not have it.
SIM_ID="$(xcrun simctl list devices available | grep -F "    $SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' || true)"
[ -n "$SIM_ID" ] || die "no available simulator named '$SIM_NAME'"

preflight_toolchain
[ "${SKIP_WEB:-0}" = 1 ] || build_web

run_xcodebuild "$ARTIFACTS/sim-build.log" \
  -project "$XCODEPROJ" -scheme "$SCHEME" -configuration Debug \
  -destination "platform=iOS Simulator,id=$SIM_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -skipPackagePluginValidation -skipMacroValidation \
  CODE_SIGNING_ALLOWED=NO build

APP="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/App.app"
log "built $APP"

if [ "$RUN" = 1 ]; then
  BUNDLE_ID="$(app_config appId)"
  xcrun simctl boot "$SIM_ID" 2>/dev/null || true
  xcrun simctl bootstatus "$SIM_ID" -b >/dev/null
  open -a Simulator
  xcrun simctl install "$SIM_ID" "$APP"
  xcrun simctl terminate "$SIM_ID" "$BUNDLE_ID" 2>/dev/null || true
  xcrun simctl launch "$SIM_ID" "$BUNDLE_ID"
  log "launched $BUNDLE_ID on '$SIM_NAME'"
fi
