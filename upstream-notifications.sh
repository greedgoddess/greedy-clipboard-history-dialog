#!/usr/bin/env bash
# upstream-notifications.sh — optional desktop notification when Clipboard
# History publishes a release that is not yet in tested-releases.json, so you
# know to run ./update-test-and-push.sh.
#
#   on       check once a day (systemd user timer)
#   off      stop checking
#   status   show whether checking is on, and the last result
#   check    check now (the timer runs "check --notify")
#
# Each new release is notified once. Checks need network access to
# extensions.gnome.org; when it is unreachable, the check is skipped quietly.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

UNIT="greedy-clipboard-history-upstream-check"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/greedy-clipboard-history-dialog"
NOTIFIED_FILE="$STATE_DIR/notified-release"
LAST_CHECK_FILE="$STATE_DIR/last-check"

usage() { sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

notify() {
    gdbus call --session --dest org.freedesktop.Notifications \
        --object-path /org/freedesktop/Notifications \
        --method org.freedesktop.Notifications.Notify \
        "Greedy Clipboard History" 0 "edit-paste-symbolic" "$1" "$2" '[]' '{}' 0 >/dev/null
}

check() {
    local notify_mode=0
    [[ "${1:-}" == --notify ]] && notify_mode=1
    mkdir -p "$STATE_DIR"

    local major latest tested
    major="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true)"
    if ! latest="$(python3 "$ROOT/scripts/upstream.py" latest --shell "$major" 2>/dev/null)"; then
        echo "$(date -Iseconds) extensions.gnome.org unreachable; skipped" > "$LAST_CHECK_FILE"
        (( notify_mode == 1 )) && return 0
        fail "Could not reach extensions.gnome.org."
    fi
    tested="$(python3 "$ROOT/scripts/upstream.py" tested --shell "$major" 2>/dev/null | cut -d' ' -f1 || true)"

    if [[ -n "$tested" ]] && (( latest <= tested )); then
        echo "$(date -Iseconds) release $latest is tested; up to date" > "$LAST_CHECK_FILE"
        say "Up to date: the newest release, $latest, is tested."
        return 0
    fi

    echo "$(date -Iseconds) release $latest is new (newest tested: ${tested:-none})" > "$LAST_CHECK_FILE"
    say "New release: $latest (newest tested: ${tested:-none}). Run ./update-test-and-push.sh"
    if (( notify_mode == 1 )) && [[ "$(cat "$NOTIFIED_FILE" 2>/dev/null)" != "$latest" ]]; then
        notify "Clipboard History release $latest is out" \
            "Run ./update-test-and-push.sh in $ROOT to build, test and publish it."
        echo "$latest" > "$NOTIFIED_FILE"
    fi
}

case "${1:-}" in
    on)
        require_command systemctl "systemd is required."
        mkdir -p "$UNIT_DIR"
        cat > "$UNIT_DIR/$UNIT.service" <<UNIT_FILE
[Unit]
Description=Check for new Clipboard History releases (greedy-clipboard-history-dialog)
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart="$ROOT/upstream-notifications.sh" check --notify
UNIT_FILE
        cat > "$UNIT_DIR/$UNIT.timer" <<UNIT_FILE
[Unit]
Description=Daily check for new Clipboard History releases

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
UNIT_FILE
        systemctl --user daemon-reload
        systemctl --user enable --now "$UNIT.timer" >/dev/null
        say "Notifications on: checked daily."
        say "If you move this checkout, run '$0 on' again from the new place." ;;
    off)
        systemctl --user disable --now "$UNIT.timer" >/dev/null 2>&1 || true
        rm -f -- "$UNIT_DIR/$UNIT.service" "$UNIT_DIR/$UNIT.timer"
        systemctl --user daemon-reload 2>/dev/null || true
        say "Notifications off." ;;
    status)
        if systemctl --user is-enabled --quiet "$UNIT.timer" 2>/dev/null; then
            say "Notifications: on"
            systemctl --user list-timers "$UNIT.timer" --no-legend 2>/dev/null | sed 's/^/  next: /' | cut -c1-80 || true
        else
            say "Notifications: off"
        fi
        say "Last check: $(cat "$LAST_CHECK_FILE" 2>/dev/null || echo never)" ;;
    check) shift; check "$@" ;;
    -h|--help|"") usage ;;
    *) fail "Unknown command: $1 (try --help)" ;;
esac
