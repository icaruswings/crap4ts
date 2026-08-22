#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.agents/skills" "$HOME/.claude/skills")

for dest in "${DESTS[@]}"; do
  target="$dest/crap4ts"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "error: refusing to replace a real directory at $target" >&2
    exit 1
  fi
done

for dest in "${DESTS[@]}"; do
  mkdir -p "$dest"
  target="$dest/crap4ts"
  ln -sfn "$REPO" "$target"
  echo "linked crap4ts -> $REPO ($dest)"
done
