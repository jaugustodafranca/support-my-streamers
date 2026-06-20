#!/usr/bin/env bash
# Packages the extension zip.
#   store (default) — Chrome Web Store upload; strips manifest "key" (dev-only ID pin).
#   dev             — local unpacked/testing zip; keeps manifest "key".
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-store}"
VERSION=$(grep '"version"' manifest.json | head -1 | sed -E 's/.*"([0-9.]+)".*/\1/')
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cp -R manifest.json src icons "$WORK"

if [ "$TARGET" = "store" ]; then
  node --input-type=module -e "
    import { readFileSync, writeFileSync } from 'node:fs';
    const path = '$WORK/manifest.json';
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    delete manifest.key;
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  "
  OUT="build/support-my-streamers-${VERSION}.zip"
elif [ "$TARGET" = "dev" ]; then
  OUT="build/support-my-streamers-${VERSION}-dev.zip"
else
  echo "Usage: scripts/package.sh [store|dev]" >&2
  exit 1
fi

mkdir -p build
rm -f "$OUT"
(
  cd "$WORK"
  zip -rq "$OLDPWD/$OUT" manifest.json src icons -x "*.DS_Store"
)
echo "Generated: $OUT ($TARGET)"
