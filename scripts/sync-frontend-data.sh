#!/usr/bin/env bash
# Copy the runtime data the frontend fetches from `/data/...` into the frontend's
# `public/` folder so a production build bundles a fallback snapshot.
#
# The frontend tries, in order: an optional env override, the `publish` branch
# raw URL, then this bundled copy (see src/app/services/radarDataSources.ts).
set -euo pipefail

SRC_DIR="${SRC_DIR:-data}"
DEST_DIR="${DEST_DIR:-frontend/Align Project Features and Plan/public/data}"

mkdir -p "$DEST_DIR"

copy_file() {
  local name="$1"
  if [ -f "$SRC_DIR/$name" ]; then
    cp "$SRC_DIR/$name" "$DEST_DIR/$name"
    echo "[sync-frontend-data] copied $name"
  else
    echo "[sync-frontend-data] skip missing $SRC_DIR/$name" >&2
  fi
}

copy_file latest-daily-dashboard.json
copy_file latest-multisource-signals.json

if [ -d "$SRC_DIR/archive" ]; then
  rm -rf "$DEST_DIR/archive"
  cp -R "$SRC_DIR/archive" "$DEST_DIR/archive"
  echo "[sync-frontend-data] copied archive/"
fi
