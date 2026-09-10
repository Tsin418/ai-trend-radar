#!/usr/bin/env bash
# Publish / restore the radar data folder to a dedicated branch (`publish`).
#
# The branch holds a single orphan snapshot commit that is force-pushed on every
# run, so raw.githubusercontent URLs always read the latest state without growing
# `main`'s history. Every snapshot is complete (not a diff), so concurrent runs
# simply overwrite each other; the last writer produces a valid full state.
#
# Because the snapshot is a full tree, each run MUST `restore` the branch
# baseline before generating its own artifacts, otherwise it force-pushes a tree
# containing only the files it happened to create.
set -euo pipefail

DATA_BRANCH="${DATA_BRANCH:-publish}"
DATA_DIR="${DATA_DIR:-data}"
REMOTE="${REMOTE:-origin}"
# Written by `restore` and checked by `publish` so a runner that skipped (or
# failed) the baseline restore cannot overwrite the branch with a partial tree.
RESTORE_MARKER="${DATA_SNAPSHOT_RESTORE_MARKER:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/data-snapshot-restored}"

usage() {
  echo "Usage: $0 {restore|publish}" >&2
  exit 2
}
[ $# -eq 1 ] || usage

log() { printf '[data-snapshot] %s\n' "$*" >&2; }

case "$1" in
  restore)
    rm -f "$RESTORE_MARKER"
    if ! git fetch --quiet "$REMOTE" "$DATA_BRANCH" 2>/dev/null; then
      log "branch $DATA_BRANCH not found; keeping existing $DATA_DIR (first run)."
      exit 0
    fi
    rm -rf "$DATA_DIR"
    git checkout --quiet FETCH_HEAD -- "$DATA_DIR"
    touch "$RESTORE_MARKER"
    log "restored $DATA_DIR from $DATA_BRANCH."
    ;;
  publish)
    if [ ! -d "$DATA_DIR" ]; then
      log "$DATA_DIR missing; nothing to publish." >&2
      exit 1
    fi
    # The snapshot is written as a full tree, so publishing without a restored
    # baseline silently drops files that this run did not generate. Refuse when
    # the branch already exists but `restore` never ran on this runner.
    if [ "${DATA_SNAPSHOT_ALLOW_UNRESTORED:-}" != "1" ] \
       && GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code "$REMOTE" "refs/heads/$DATA_BRANCH" >/dev/null 2>&1 \
       && [ ! -f "$RESTORE_MARKER" ]; then
      log "refusing to publish: run 'restore' first (or set DATA_SNAPSHOT_ALLOW_UNRESTORED=1)." >&2
      exit 1
    fi
    git config user.name "github-actions[bot]" >/dev/null 2>&1 || true
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com" >/dev/null 2>&1 || true
    tmp_index="$(mktemp)"
    trap 'rm -f "$tmp_index"' EXIT
    export GIT_INDEX_FILE="$tmp_index"
    git read-tree --empty
    git add -f -- "$DATA_DIR"
    tree="$(git write-tree)"
    commit="$(printf 'chore(radar): publish data snapshot %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | git commit-tree "$tree")"
    unset GIT_INDEX_FILE
    for attempt in 1 2 3; do
      if git push --force "$REMOTE" "$commit:refs/heads/$DATA_BRANCH" 2> /tmp/data-snapshot-push.log; then
        log "published snapshot $commit to $DATA_BRANCH."
        exit 0
      fi
      log "push attempt $attempt failed; retrying..." >&2
      sleep 3
    done
    cat /tmp/data-snapshot-push.log >&2 || true
    exit 1
    ;;
  *)
    usage
    ;;
esac
