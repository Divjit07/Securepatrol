#!/bin/bash
# Turn the raw Playwright captures in .shots/ into the web assets in public/shots/.
#
# The storyboard shows these as ordinary <img> elements rather than WebGL
# textures, so they need to survive a 2x display at their rendered size: wide
# screens go out at 1280 and 2560 CSS px, phones at 540 and 1080. Anything
# smaller and the UI text in the screenshot turns to mush, which is the whole
# reason we stopped painting them onto 3D meshes.
#
#     ./scripts/export_shots.sh
set -euo pipefail
cd "$(dirname "$0")/.."

Q=86
OUT=public/shots
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# raw            → asset          orientation
MAP=(
  "admin-laptop:ops-console:wide"
  "client-laptop:client-portal:wide"
  "client-incident:client-incident:wide"
  "report-scans:report-scans:wide"
  "report-hours:report-hours:wide"
  "client-mobile:client-mobile:phone"
  "guard-incident:guard-6-incident:phone"
  "guard-dashboard:guard-0-dashboard:phone"
)

for entry in "${MAP[@]}"; do
  IFS=: read -r raw name kind <<<"$entry"
  src=".shots/$raw.png"
  [ -f "$src" ] || { echo "skip $name (no $src)"; continue; }

  if [ "$kind" = wide ]; then
    w1=1280; w2=2560
  else
    w1=540; w2=1080
  fi

  for w in "$w1:" "$w2:@2x"; do
    IFS=: read -r width suffix <<<"$w"
    cp "$src" "$TMP/in.png"
    # sips -Z fits the long edge, so pass the width as the bound and let the
    # aspect ratio pick the height.
    sips -s format jpeg -s formatOptions "$Q" \
      --resampleWidth "$width" "$TMP/in.png" --out "$OUT/$name$suffix.jpg" >/dev/null
  done
  echo "$name  ${w1}px + ${w2}px"
done

echo
ls -la "$OUT"
