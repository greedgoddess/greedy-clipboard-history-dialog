#!/usr/bin/env bash
# verify.sh — shows what is installed and whether it is working.
# Changes nothing. Exits non-zero if the current version is not installed.
# See docs/installation.md#checking-the-installation
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
variant="$(installed_variant)"
case "$variant" in
    current)       say "Current version, metadata version $(metadata_version "$INSTALL_DIR/metadata.json")" ;;
    previous-fork) say "PREVIOUS fork version. Run ./uninstall-previous-version.sh, then ./install.sh" ;;
    other)         say "Not this fork (probably the stock extension)" ;;
    none)          say "Not installed" ;;
esac

say
say "== Extension state =="
gnome-extensions info "$UUID" 2>/dev/null | grep -E '^\s*(Enabled|State|Version):' \
    || say "GNOME Shell does not know the extension yet (log out and back in)."

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
say "== Recent GNOME Shell messages about this extension (this boot) =="
messages="$(journalctl -b --no-pager -o cat /usr/bin/gnome-shell 2>/dev/null \
    | grep -iE 'clipboard[- ]history' | tail -n 10)"
say "${messages:-None.}"

[[ "$variant" == current ]]
