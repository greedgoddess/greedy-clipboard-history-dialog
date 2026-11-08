#!/usr/bin/env bash
# update.sh — pulls this project's latest commits, builds from the latest
# release of the original extension, and installs the result.
#
# Only fast-forwards: if this checkout has local commits or changes that are
# not on GitHub, it stops instead of merging. If the build fails, the
# installed extension is left as it is.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

usage() {
    say "Usage: ./update.sh [--yes]"
    say "Runs 'git pull --ff-only', ./build.sh, then ./install.sh."
    say "  -y, --yes   passed on to ./install.sh"
}
parse_common_options "$@"

require_command git "Install it with: sudo dnf install git"

remote_url="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
[[ -n "$remote_url" ]] || fail "This checkout has no 'origin' remote."
if [[ "$remote_url" != git@github.com:* && "$remote_url" != ssh://* ]]; then
    warn "origin is not an SSH remote ($remote_url). This project is pushed and pulled over SSH."
fi

[[ -z "$(git -C "$ROOT" status --porcelain)" ]] \
    || fail "This checkout has uncommitted changes. Commit or discard them first."

git -C "$ROOT" pull --ff-only
"$ROOT/build.sh"
"$ROOT/install.sh" "$@"
