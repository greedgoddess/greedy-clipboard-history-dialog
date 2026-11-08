#!/usr/bin/env bash
# smoke-test.sh — loads build/ in a headless GNOME Shell and checks that it
# becomes active without errors, and that Open at mouse pointer hooks in.
#
# Runs in a throwaway home folder and D-Bus session: your own session,
# settings and clipboard history are not touched.
#
# Needs GNOME Shell and is meant to run on a GNOME desktop. On headless
# systems (servers, CI containers) GNOME Shell may not start; the test then
# fails, with exit status 2 instead of 1, so that it is clear GNOME Shell
# did not start, rather than that the extension failed.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../scripts/common.sh
source "$ROOT/scripts/common.sh"

require_command gnome-shell "It is part of GNOME Shell."
require_command dbus-run-session "Install it with: sudo dnf install dbus-daemon"
[[ -f "$BUILT_DIR/metadata.json" ]] || fail "Nothing built yet."

gnome-shell --help 2>&1 | grep -q -- '--headless' \
    || fail "This GNOME Shell has no --headless mode."

SANDBOX="$(mktemp -d)"
trap 'rm -rf -- "$SANDBOX"' EXIT
mkdir -p "$SANDBOX"/{home,config,cache,state,run} "$SANDBOX/data/gnome-shell/extensions"
chmod 700 "$SANDBOX/run"
cp -a -- "$BUILT_DIR" "$SANDBOX/data/gnome-shell/extensions/$UUID"
# Load the optional features too (1Password integration, large spacing switched
# on), so that their code is covered.
echo "export const FEATURES = {quickAccess: true, largeSpacing: true};" > "$SANDBOX/data/gnome-shell/extensions/$UUID/features.js"

LOG="$SANDBOX/gnome-shell.log"
TIMEOUT="${SMOKE_TEST_TIMEOUT:-60}"

env -i PATH="$PATH" HOME="$SANDBOX/home" LANG="${LANG:-C.UTF-8}" \
    XDG_CONFIG_HOME="$SANDBOX/config" XDG_DATA_HOME="$SANDBOX/data" \
    XDG_CACHE_HOME="$SANDBOX/cache" XDG_STATE_HOME="$SANDBOX/state" \
    XDG_RUNTIME_DIR="$SANDBOX/run" UUID="$UUID" LOG="$LOG" TIMEOUT="$TIMEOUT" \
    dbus-run-session -- bash -c '
        gsettings set org.gnome.shell enabled-extensions "[\"$UUID\"]"
        gsettings set org.gnome.shell welcome-dialog-last-shown-version "999"
        dconf write /org/gnome/shell/extensions/greedy-clipboard-history-dialog/cursor-follow true
        dconf write /org/gnome/shell/extensions/greedy-clipboard-history-dialog/update-notifications false
        dconf write /org/gnome/shell/extensions/greedy-clipboard-history-dialog/large-spacing true

        flags=(--headless --virtual-monitor 1280x800)
        gnome-shell --help 2>&1 | grep -q -- "--wayland" && flags+=(--wayland)
        gnome-shell "${flags[@]}" >"$LOG" 2>&1 &
        shell=$!

        state=""
        for ((i = 0; i < TIMEOUT; i++)); do
            sleep 1
            kill -0 "$shell" 2>/dev/null || break
            state="$(gnome-extensions info "$UUID" 2>/dev/null | sed -n "s/^ *State: *//p")"
            [[ "$state" == ACTIVE || "$state" == ENABLED || "$state" == ERROR ]] && break
        done
        sleep 2   # Let late messages reach the log
        kill "$shell" 2>/dev/null || true
        wait "$shell" 2>/dev/null || true
        echo "$state" > "$LOG.state"
    ' >>"$SANDBOX/session.log" 2>&1  # Messages from services started in the test session

state="$(cat "$LOG.state" 2>/dev/null || true)"
failures=0
report() { printf '  %s  %s\n' "$1" "$2"; [[ "$1" == pass ]] || failures=$((failures + 1)); }
show_logs() {
    say
    say "Last lines of the headless GNOME Shell log:"
    tail -n 30 "$LOG" | sed 's/^/    /'
    if [[ -s "$SANDBOX/session.log" ]]; then
        say "Other messages from the test session:"
        tail -n 15 "$SANDBOX/session.log" | sed 's/^/    /'
    fi
}

# GNOME Shell never answered about any extension: it did not start, whatever
# the extension does. Reported separately from extension failures.
if [[ -z "$state" ]]; then
    report FAIL "headless GNOME Shell started"
    say "        This test needs GNOME Shell and may fail on headless systems"
    say "        (no graphical session), such as servers and CI containers."
    show_logs
    exit 2
fi
report pass "headless GNOME Shell started"
[[ "$state" == ACTIVE || "$state" == ENABLED ]] \
    && report pass "extension active" || report FAIL "extension active (state: $state)"
if grep -qiE "($UUID|greedy|upstream-extension|cursorFollow|updateNotifier|quickAccess|onePassword|1Password integration|largeSpacing|Large spacing|large spacing).*(error|exception|not loaded|inactive)|JS ERROR.*($UUID|greedy|cursorFollow|updateNotifier|quickAccess|onePassword|largeSpacing|upstream-)" "$LOG"; then
    report FAIL "no errors from the extension"
else
    report pass "no errors from the extension"
fi
if grep -q 'Open at mouse pointer" is inactive' "$LOG"; then
    report FAIL "Open at mouse pointer hooked into the panel menu"
else
    report pass "Open at mouse pointer hooked into the panel menu"
fi

if (( failures > 0 )); then
    show_logs
    exit 1
fi
