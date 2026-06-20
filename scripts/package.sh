#!/usr/bin/env bash
# Packages the extension for upload to the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(grep '"version"' manifest.json | head -1 | sed -E 's/.*"([0-9.]+)".*/\1/')
OUT="build/support-my-streamers-$VERSION.zip"
mkdir -p build
rm -f "$OUT"
zip -rq "$OUT" manifest.json src icons -x "*.DS_Store"
echo "Generated: $OUT"
