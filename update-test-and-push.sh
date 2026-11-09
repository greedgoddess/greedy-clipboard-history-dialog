#!/usr/bin/env bash
# update-test-and-push.sh — developer side. Builds the newest release of
# Clipboard History, runs the test suite, and if everything passes, records
# the release in tested-releases.json and README.md and commits that. With
# --push it also publishes the commit to GitHub; machines running
# ./update.sh then build the newly tested release.
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
  --push            also push the commit to GitHub (only from main); asks for
                    the result of each manual checklist first and records it
  --no-smoke-test   skip the headless GNOME Shell test (not with --push)
  --install         also install the tested build on this machine
  -h, --help        show this help
USAGE
}

VERSION=""
FORCE=0
PUSH=0
SMOKE=1
INSTALL=0
while (( $# > 0 )); do
    case "$1" in
        --version) VERSION="${2:?--version needs a number}"; shift 2 ;;
        --force) FORCE=1; shift ;;
        --push) PUSH=1; shift ;;
        --no-push) PUSH=0; shift ;;   # The default; accepted for older habits
        --no-smoke-test) SMOKE=0; shift ;;
        --install) INSTALL=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown option: $1 (try --help)" ;;
    esac
done

require_command git "Install it with: sudo dnf install git"
[[ "$(current_mode)" == dev ]] \
    || fail "This machine is set up for users. Run ./install.sh --dev to make it a developer machine."
cd "$ROOT"

# ---- Repository ready? ----------------------------------------------------------

remote_url="$(git remote get-url origin 2>/dev/null || true)"
[[ "$remote_url" == git@github.com:* || "$remote_url" == ssh://* ]] \
    || fail "origin must be an SSH remote (it is '$remote_url')."
[[ -z "$(git status --porcelain)" ]] || fail "Uncommitted changes. Commit or discard them first."
(( PUSH == 0 || SMOKE == 1 )) || fail "--push needs the full test suite; drop --no-smoke-test."
branch="$(git rev-parse --abbrev-ref HEAD)"
if (( PUSH == 1 )) && [[ "$branch" != main ]]; then
    fail "--push publishes test records only from main; this is '$branch'."
fi
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

# ---- Manual checks (with --push) ------------------------------------------------
# [release:manual-checks] Before a test record is published, the result of
# each manual checklist is asked for and recorded with it: passed, not
# checked this time, or failed (which stops here, with nothing recorded).
# See CONTRIBUTING.md#manual-checks

MANUAL_CHECKS=(
    "Open at mouse pointer|docs/cursor-follow.md#testing"
    "Private history folder|docs/private-history.md#testing"
    "Clear unpinned entries at login|docs/clear-at-login.md#testing"
    "Hover preview|docs/hover-preview.md#testing"
    "Large spacing|docs/large-spacing.md#testing"
    "Password managers (1Password)|docs/password-managers.md#testing"
    "Gestures|docs/gestures.md#testing"
)

entry="$(mktemp)"
manual="$(mktemp)"
trap 'rm -f -- "$entry" "$manual"' EXIT
if (( PUSH == 1 )); then
    [[ -t 0 ]] || fail "--push asks for the manual checks; run it in a terminal."
    say "Manual checks: for each checklist, answer y (passed), n (not checked this time) or f (failed)."
    for check in "${MANUAL_CHECKS[@]}"; do
        name="${check%%|*}"
        while true; do
            read -r -p "  $name (${check#*|}) [y/n/f]: " answer
            case "$answer" in
                y|Y) printf '%s\tpassed\n' "$name" >>"$manual"; break ;;
                n|N) printf '%s\tnot checked\n' "$name" >>"$manual"; break ;;
                f|F) fail "Manual check failed: $name. Nothing was recorded or pushed." ;;
                *) say "  Please answer y, n or f." ;;
            esac
        done
    done
fi

# ---- Record, commit, push --------------------------------------------------------

python3 - "$ROOT/build/report.json" "$(python3 "$UPSTREAM" content-hash "$ROOT/build/release.zip")" \
    "$VERSION" "GNOME Shell ${SHELL_VERSION:-?}" "$(git rev-parse --short HEAD)" "$SMOKE" "$manual" >"$entry" <<'PY'
import datetime, json, sys
report, content_hash, version, tested_on, commit, smoke, manual_file = sys.argv[1:]
r = json.load(open(report))
manual = dict(line.rstrip('\n').split('\t') for line in open(manual_file) if line.strip())
passed = sum(result == 'passed' for result in manual.values())
print(json.dumps({
    'version': int(version),
    'version_name': r['upstream_version_name'],
    'content_sha256': content_hash,
    'shell_versions': r['shell_versions'],
    'tested_on': tested_on + ('' if smoke == '1' else ', without smoke test'),
    'evidence': ['unit tests', 'build checks'] + (['headless GNOME Shell smoke test'] if smoke == '1' else [])
                + ([f'manual checks: {passed} of {len(manual)} passed'] if manual else []),
    'manual_checks': manual,
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
        say "Committed locally, not pushed. Publish with 'git push' (or run again with --push)."
    fi
fi

if (( INSTALL == 1 )); then
    # The build has just passed the tests; it is recorded as tested from now on.
    "$ROOT/install.sh" --yes --allow-untested
fi
