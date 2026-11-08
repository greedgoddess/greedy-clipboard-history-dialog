#!/usr/bin/env bash
# uninstall.sh — removes this extension for the current user.
#
# By default keeps the clipboard history and settings, so a later install
# picks up where you left off. With --purge, also deletes those and the
# installer's backup.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

usage() {
    say "Usage: ./uninstall.sh [--purge] [--yes]"
    say "Removes the installed extension. Keeps clipboard history and settings."
    say "  --purge     also delete clipboard history, settings and the installer backup"
    say "  -y, --yes   answer yes to every question"
}

PURGE=0
other_args=()
for arg in "$@"; do
    if [[ "$arg" == --purge ]]; then PURGE=1; else other_args+=("$arg"); fi
done
parse_common_options "${other_args[@]+"${other_args[@]}"}"

require_command gnome-extensions "It is part of GNOME Shell."

if [[ -d "$INSTALL_DIR" ]]; then
    say "This removes $INSTALL_DIR"
    if (( PURGE == 1 )); then
        say "and also deletes, permanently:"
        say "  - your clipboard history in $HISTORY_DIR"
        say "  - all settings of this extension"
        say "  - the installer backup in $BACKUP_DIR"
    else
        say "Clipboard history and settings are kept."
    fi
    confirm "Continue?" || { say "Cancelled. Nothing was changed."; exit 0; }

    gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
    rm -rf -- "$INSTALL_DIR"
    "$ROOT/upstream-notifications.sh" off >/dev/null
    rm -f -- "$MODE_FILE"
    say "Extension removed (and release notifications, if they were on)."
else
    say "No installed copy found in $INSTALL_DIR."
    (( PURGE == 1 )) || exit 0
    confirm "Delete clipboard history, settings and backup anyway?" \
        || { say "Cancelled."; exit 0; }
fi

if (( PURGE == 1 )); then
    rm -rf -- "$HISTORY_DIR" "$WORK_DIR"
    if command -v dconf >/dev/null; then
        dconf reset -f "$SETTINGS_PATH"
    fi
    say "Clipboard history, settings and backup deleted."
fi

say "Log out and back in to unload the extension completely."
