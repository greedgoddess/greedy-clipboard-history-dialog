#!/usr/bin/env bash
# verify.sh — shows what is installed and whether it is working.
# Changes nothing. Exits non-zero if the extension is not installed.
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

usage() {
    say "Usage: ./verify.sh"
    say "Prints GNOME Shell, extension and setting status. Changes nothing."
}
parse_common_options "$@"

say "== GNOME Shell =="
gnome-shell --version 2>/dev/null || say "(gnome-shell not found)"

say
say "== Installed copy =="
if [[ -f "$INSTALL_DIR/metadata.json" ]]; then
    say "$UUID, $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("version-name","?"))' "$INSTALL_DIR/metadata.json")"
    if [[ -f "$BUILT_DIR/metadata.json" ]] && ! diff -rq "$BUILT_DIR" "$INSTALL_DIR" >/dev/null 2>&1; then
        say "Note: build/ holds a different build than the installed one; run ./install.sh to install it."
    fi
else
    say "Not installed"
fi
if legacy_enabled; then
    say "WARNING: the old $LEGACY_UUID is still enabled; two clipboard panels"
    say "are running. Run ./uninstall-previous-version.sh"
fi

say
say "== Extension state =="
gnome-extensions info "$UUID" 2>/dev/null | grep -E '^\s*(Enabled|State|Version):' \
    || say "GNOME Shell does not know the extension yet (log out and back in)."

say
say "== Mode =="
if [[ "$(current_mode)" == dev ]]; then
    say "dev"
    "$ROOT/upstream-notifications.sh" status | sed 's/^/  /'
else
    say "user"
fi

say
say "== Open at mouse pointer =="
value="$(dconf read "$CURSOR_FOLLOW_KEY" 2>/dev/null || true)"
case "$value" in
    true)  say "On" ;;
    false) say "Off (switch it on in the extension preferences, under Placement)" ;;
    "")    say "Not set, so off (the default)" ;;
    *)     say "Unexpected value: $value" ;;
esac

say
say "== Last build =="
if [[ -f "$ROOT/build/BUILD-INFO" ]]; then cat "$ROOT/build/BUILD-INFO"; else say "No build yet."; fi

say
say "== Recent GNOME Shell messages about this extension (this boot) =="
messages="$(journalctl -b --no-pager -o cat /usr/bin/gnome-shell 2>/dev/null \
    | grep -iE 'clipboard[- ]history|greedy' | tail -n 10)"
say "${messages:-None.}"

[[ -f "$INSTALL_DIR/metadata.json" ]]
