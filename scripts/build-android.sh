#!/usr/bin/env bash
# Debug build for Android, and (with --run) install + launch it on an
# emulator or a connected phone.
#
#   scripts/build-android.sh            # build app-debug.apk
#   scripts/build-android.sh --run      # boot the AVD if nothing is connected, install, launch
#   AVD=Pixel_8 scripts/build-android.sh --run
. "$(dirname "$0")/lib.sh"

RUN=0
for a in "$@"; do
  case "$a" in
    --run) RUN=1 ;;
    --skip-web) SKIP_WEB=1 ;;
    *) die "unknown option: $a" ;;
  esac
done

preflight_toolchain() { require_cmd node npm git; }
preflight_toolchain
android_env
[ "${SKIP_WEB:-0}" = 1 ] || build_web_android

log "gradle assembleDebug (log: artifacts/android-debug.log)"
(cd "$ROOT/android" && ./gradlew --quiet assembleDebug > "$ARTIFACTS/android-debug.log" 2>&1) || { tail -30 "$ARTIFACTS/android-debug.log" >&2; die "debug build failed"; }
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
log "built ${APK#$ROOT/}"

if [ "$RUN" = 1 ]; then
  if ! adb devices | grep -qE "device$"; then
    AVD="${AVD:-$(emulator -list-avds | head -1)}"
    [ -n "$AVD" ] || die "no device connected and no AVD to boot"
    log "booting emulator $AVD"
    nohup emulator -avd "$AVD" -no-snapshot-save -no-boot-anim >/dev/null 2>&1 &
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
  fi
  APP_ID="$(app_config appId)"
  adb install -r "$APK" >/dev/null
  adb shell am force-stop "$APP_ID" || true
  adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  log "launched $APP_ID"
fi
