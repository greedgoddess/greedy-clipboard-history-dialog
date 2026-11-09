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
    # build-info.json identifies a build; other files differ on purpose
    # (install.sh records the optional features in features.js).
    if [[ -f "$BUILT_DIR/build-info.json" ]] \
        && ! cmp -s "$BUILT_DIR/build-info.json" "$INSTALL_DIR/build-info.json"; then
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
say "== Mode and update notifications =="
if [[ "$(current_mode)" == dev ]]; then
    say "Mode: dev (notifications watch Clipboard History releases)"
else
    say "Mode: user (notifications watch this project's repository)"
fi
say "Notifications: $([[ "$(dconf read "${SETTINGS_PATH}update-notifications" 2>/dev/null)" == true ]] && echo on || echo off)"
last_check="$(dconf read "${SETTINGS_PATH}update-last-check" 2>/dev/null | grep -oE '[0-9]+$' || true)"
say "Last check: $([[ -n "$last_check" && "$last_check" != 0 ]] && date -d "@$last_check" '+%Y-%m-%d %H:%M' || echo never)"

say
say "== Password manager integration =="
if grep -q 'passwordManagers: true' "$INSTALL_DIR/features.js" 2>/dev/null; then
    say "Installed; enabled: $(dconf read "${SETTINGS_PATH}password-managers" 2>/dev/null || true); shortcut opens: $(dconf read "${SETTINGS_PATH}shortcut-password-manager" 2>/dev/null || true)"
else
    say "Not installed (./install.sh --with-password-managers adds it)"
fi

say
say "== Private history folder =="
state="$([[ "$(dconf read "${SETTINGS_PATH}private-history" 2>/dev/null)" != false ]] && echo On || echo Off)"
say "$state; folder permissions: $(stat -c '%A' "$HISTORY_DIR" 2>/dev/null || echo 'not created yet')"

say
say "== Clear unpinned entries at login =="
say "$([[ "$(dconf read "${SETTINGS_PATH}clear-at-login" 2>/dev/null)" == true ]] && echo On || echo Off)"

say
say "== Hover preview =="
say "$([[ "$(dconf read "${SETTINGS_PATH}hover-preview" 2>/dev/null)" == true ]] && echo On || echo "Off (Preferences → Cursor-Follow → Preview on hover)")"

say
say "== Gestures =="
if grep -q 'gestures: true' "$INSTALL_DIR/features.js" 2>/dev/null; then
    say "Installed; three-finger tap: $(dconf read "${SETTINGS_PATH}gesture-touchscreen-tap" 2>/dev/null || echo false); three-finger hold: $(dconf read "${SETTINGS_PATH}gesture-touchpad-hold" 2>/dev/null || echo false)"
else
    say "Not installed (./install.sh --with-gestures adds them)"
fi

say
say "== Large spacing =="
if grep -q 'largeSpacing: true' "$INSTALL_DIR/features.js" 2>/dev/null; then
    say "Installed; switch: $([[ "$(dconf read "${SETTINGS_PATH}large-spacing" 2>/dev/null)" == true ]] && echo on || echo off)"
else
    say "Not installed (./install.sh --with-large-spacing adds it)"
fi

say
say "== Open at mouse pointer =="
value="$(dconf read "$CURSOR_FOLLOW_KEY" 2>/dev/null || true)"
case "$value" in
    true)  say "On" ;;
    false) say "Off (switch it on in the extension preferences, under Cursor-Follow)" ;;
    "")    say "Not set, so off (the default)" ;;
    *)     say "Unexpected value: $value" ;;
esac

say
say "== Last build =="
if [[ -f "$ROOT/build/BUILD-INFO" ]]; then cat "$ROOT/build/BUILD-INFO"; else say "No build yet."; fi

say
say "== Recent GNOME Shell messages about this extension (this boot) =="
# With one line of context, so that a warning's message shows together with
# the stack trace lines below it that name this extension's files.
messages="$(journalctl -b --no-pager -o cat /usr/bin/gnome-shell 2>/dev/null \
    | grep -iE -B1 'clipboard[- ]history|greedy' | grep -v '^--$' | tail -n 12)"
say "${messages:-None.}"

[[ -f "$INSTALL_DIR/metadata.json" ]]
