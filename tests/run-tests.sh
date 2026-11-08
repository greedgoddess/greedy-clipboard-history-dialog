#!/usr/bin/env bash
# run-tests.sh — the test suite. Exit status 0 only if everything that ran passed.
#
#   1. Unit tests: the patcher, the installer and the cursor-follow hook
#      (the last one needs Node.js; skipped without it).
#   2. Build checks: build/ against the release it was built from.
#   3. Smoke test: build/ loaded in a headless GNOME Shell.
#
#   --no-smoke-test   skip 3
#   --unit-only       run 1 only (no build needed)
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SMOKE=1
BUILD_CHECKS=1
for arg in "$@"; do
    case "$arg" in
        --no-smoke-test) SMOKE=0 ;;
        --unit-only) SMOKE=0; BUILD_CHECKS=0 ;;
        *) echo "Unknown option: $arg" >&2; exit 2 ;;
    esac
done

status=0
section() { echo; echo "$1"; }

section "Unit tests: patcher"
python3 -m unittest -q tests/test_patch_release.py 2>&1 | sed 's/^/  /'
(( PIPESTATUS[0] == 0 )) || status=1

section "Unit tests: installer"
tests/test_installer.sh || status=1

section "Unit tests: cursor-follow hook"
if command -v node >/dev/null; then
    node --import ./tests/js/register.mjs --test --test-reporter=dot tests/js/*.test.mjs 2>&1 | sed 's/^/  /'
    (( PIPESTATUS[0] == 0 )) && echo "  pass  all" || status=1
else
    echo "  skipped (Node.js not installed: sudo dnf install nodejs)"
fi

if (( BUILD_CHECKS == 1 )); then
    section "Build checks"
    python3 tests/check_build.py || status=1
fi

if (( SMOKE == 1 )); then
    section "Smoke test (headless GNOME Shell)"
    tests/smoke-test.sh || status=1
fi

echo
(( status == 0 )) && echo "All tests passed." || echo "Tests FAILED."
exit $status
