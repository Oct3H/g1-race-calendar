#!/bin/bash
set -euo pipefail
project="$(cd "$(dirname "$0")/.." && pwd)"
build="$(mktemp -d)"
trap 'rm -rf "$build"' EXIT
app="$build/GⅠ 赛马日历 Dev v2.4.app"
mkdir -p "$app/Contents/"{MacOS,Resources} "$project/dist"
cp "$project/desktop/Info.plist" "$app/Contents/"
cp -R "$project/design" "$app/Contents/Resources/"
cp "$project/research/2026-11-04-identity/verified.json" "$app/Contents/Resources/"
cp "$project/research/2026-11-04-identity/live/jairs_tenno.response" "$app/Contents/Resources/"
cp "$project/research/2026-10-27-japan/research-cache-replay.json" "$app/Contents/Resources/design/data/japan-schedule-2026.json"
xcrun swiftc -target "$(uname -m)-apple-macos13.0" -module-cache-path "${RACE_CALENDAR_MODULE_CACHE:-$build/modules}" \
    "$project/desktop/"*.swift -o "$app/Contents/MacOS/RaceCalendar"
codesign --force --sign - "$app"
destination="$project/dist/$(basename "$app")"
ditto "$app" "$destination"
codesign --verify --strict "$destination"
printf '%s\n' "$destination"
