#!/usr/bin/env bash
# Publish / restore the radar data folder to a dedicated branch (`publish`).
#
# The branch holds a single orphan snapshot commit that is force-pushed on every
# run, so raw.githubusercontent URLs always read the latest state without growing
# `main`'s history. Every snapshot is complete (not a diff), so concurrent runs
# simply overwrite each other; the last writer produces a valid full state.
set -euo pipefail

DATA_BRANCH="${DATA_BRANCH:-publish}"
DATA_DIR="${DATA_DIR:-data}"
REMOTE="${REMOTE:-origin}"

usage() {
  echo "Usage: $0 {restore|publish}" >&2
  exit 2
}
[ $# -eq 1 ] || usage

log() { printf '[data-snapshot] %s\n' "$*" >&2; }

case "$1" in
  restore)
    if ! git rev-parse --verify --quiet "refs/remotes/$REMOTE/$DATA_BRANCH" >/dev/null 2>&1; then
      log "branch $DATA_BRANCH not found; keeping existing $DATA_DIR (first run)."
      exit 0
    fi
    git fetch --quiet "$REMOTE" "$DATA_BRANCH"
    git checkout --quiet FETCH_HEAD -- "$DATA_DIR"
    log "restored $DATA_DIR from $DATA_BRANCH."
    ;;
  publish)
    if [ ! -d "$DATA_DIR" ]; then
      log "$DATA_DIR missing; nothing to publish." >&2
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
