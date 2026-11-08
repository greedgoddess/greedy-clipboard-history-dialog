#!/usr/bin/env bash
# run-tests.sh — tests the build in build/: static checks, then a headless
# GNOME Shell smoke test. Exit status 0 only if everything passed.
#   --no-smoke-test   static checks only
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

SMOKE=1
[[ "${1:-}" == --no-smoke-test ]] && SMOKE=0

status=0
echo "Static checks:"
python3 "$ROOT/tests/check_build.py" || status=1
if (( SMOKE == 1 )); then
    echo "Smoke test (headless GNOME Shell):"
    "$ROOT/tests/smoke-test.sh" || status=1
fi
echo
(( status == 0 )) && echo "All tests passed." || echo "Tests FAILED."
exit $status
