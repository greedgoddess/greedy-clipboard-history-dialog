#!/usr/bin/env bash
# update-test-and-push.sh — developer side. Builds the newest release of
# Clipboard History, runs the test suite, and if everything passes, records
# the release in tested-releases.json and README.md and pushes that to GitHub.
# Machines running ./update.sh then build the newly tested release.
#
# Does nothing if the newest release is already tested with the current
# feature code. Nothing is committed or pushed if a build or test fails.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"
UPSTREAM="$ROOT/scripts/upstream.py"

usage() {
    cat <<USAGE
Usage: ./update-test-and-push.sh [options]
  --version N       test release N instead of the newest
  --force           test again even if the release is already tested
  --no-push         commit, but do not push
  --no-smoke-test   static checks only (implies --no-push)
  --install         also install the tested build on this machine
  -h, --help        show this help
USAGE
}

VERSION=""
FORCE=0
PUSH=1
SMOKE=1
INSTALL=0
while (( $# > 0 )); do
    case "$1" in
        --version) VERSION="${2:?--version needs a number}"; shift 2 ;;
        --force) FORCE=1; shift ;;
        --no-push) PUSH=0; shift ;;
        --no-smoke-test) SMOKE=0; PUSH=0; shift ;;
        --install) INSTALL=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown option: $1 (try --help)" ;;
    esac
done

require_command git "Install it with: sudo dnf install git"
[[ "$(current_mode)" == dev ]] \
    || fail "This machine is set up for users. Run ./install.sh --dev to set up the developer tools."
cd "$ROOT"

# ---- Repository ready? ----------------------------------------------------------

remote_url="$(git remote get-url origin 2>/dev/null || true)"
[[ "$remote_url" == git@github.com:* || "$remote_url" == ssh://* ]] \
    || fail "origin must be an SSH remote (it is '$remote_url')."
[[ -z "$(git status --porcelain)" ]] || fail "Uncommitted changes. Commit or discard them first."
git pull -q --ff-only

# ---- Which release? --------------------------------------------------------------

SHELL_VERSION="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+(\.[0-9]+)*' | head -n1 || true)"
SHELL_MAJOR="${SHELL_VERSION%%.*}"
if [[ -z "$VERSION" ]]; then
    say "Looking up the newest release on extensions.gnome.org…"
    VERSION="$(python3 "$UPSTREAM" latest --shell "$SHELL_MAJOR")"
fi
say "Release: $VERSION"

# Already tested with the current feature code? Then there is nothing to do.
tested_commit="$(python3 -c '
import json, sys
for r in json.load(open(sys.argv[1])):
    if r["version"] == int(sys.argv[2]):
        print(r["feature_commit"])
' tested-releases.json "$VERSION")"
if (( FORCE == 0 )) && [[ -n "$tested_commit" ]] \
    && git diff --quiet "$tested_commit" HEAD -- feature scripts/patch_release.py 2>/dev/null; then
    say "Release $VERSION is already tested with the current feature code. Nothing to do."
    say "(Use --force to test it again.)"
    exit 0
fi

# ---- Build and test ----------------------------------------------------------------

"$ROOT/build.sh" --version "$VERSION"
say
if (( SMOKE == 1 )); then
    "$ROOT/tests/run-tests.sh" || fail "Tests failed. Nothing was committed."
else
    "$ROOT/tests/run-tests.sh" --no-smoke-test || fail "Tests failed. Nothing was committed."
fi

# ---- Record, commit, push --------------------------------------------------------

entry="$(mktemp)"
trap 'rm -f -- "$entry"' EXIT
python3 - "$ROOT/build/report.json" "$(python3 "$UPSTREAM" content-hash "$ROOT/build/release.zip")" \
    "$VERSION" "GNOME Shell ${SHELL_VERSION:-?}" "$(git rev-parse --short HEAD)" "$SMOKE" >"$entry" <<'PY'
import datetime, json, sys
report, content_hash, version, tested_on, commit, smoke = sys.argv[1:]
r = json.load(open(report))
print(json.dumps({
    'version': int(version),
    'version_name': r['upstream_version_name'],
    'content_sha256': content_hash,
    'shell_versions': r['shell_versions'],
    'tested_on': tested_on + ('' if smoke == '1' else ', static checks only'),
    'date': datetime.date.today().isoformat(),
    'feature_commit': commit,
}))
PY
python3 "$UPSTREAM" record-test "$entry"

git add tested-releases.json README.md
if git diff --cached --quiet; then
    say "Nothing changed in tested-releases.json."
else
    version_name="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version_name"])' "$entry")"
    git commit -q -m "Test Clipboard History $version_name ($VERSION) on GNOME Shell ${SHELL_VERSION:-?}"
    say "Committed: $(git log -1 --format=%s)"
    if (( PUSH == 1 )); then
        git push -q
        say "Pushed. Other machines get this release with ./update.sh"
    else
        say "Not pushed (run 'git push' when ready)."
    fi
fi

if (( INSTALL == 1 )); then
    "$ROOT/install.sh" --yes
fi
