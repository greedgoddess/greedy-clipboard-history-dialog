#!/usr/bin/env bash
# install.sh — installs the build made by ./build.sh for the current user.
#
# Replaces an installed copy of this extension, keeping one backup of it in
# ~/.local/share/greedy-clipboard-history-dialog/backup/. Never touches the
# clipboard history or existing settings, with one exception: the first time
# it is installed, "Open at mouse pointer" is switched on (later choices in
# the preferences are respected).
#
# Both modes install the same build. --dev also sets up the developer tools
# (daily release notifications, ./update-test-and-push.sh); --user removes
# them. Without either flag, the machine keeps its current mode (user on a
# first install).
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

usage() {
    say "Usage: ./install.sh [--dev | --user] [--yes]"
    say "Installs the build in build/ for the current user. Run ./build.sh first."
    say "  --dev       also set up the developer tools (release notifications,"
    say "              ./update-test-and-push.sh)"
    say "  --user      remove the developer tools"
    say "              (without either, the machine keeps its current mode)"
    say "  -y, --yes   answer yes to every question"
}

MODE="$(current_mode)"
other_args=()
for arg in "$@"; do
    case "$arg" in
        --dev) MODE=dev ;;
        --user) MODE=user ;;
        *) other_args+=("$arg") ;;
    esac
done
parse_common_options "${other_args[@]+"${other_args[@]}"}"

# ---- Checks before anything is changed -------------------------------------

require_command gnome-extensions "It is part of GNOME Shell."
require_command gsettings "Install it with: sudo dnf install glib2"
require_command dconf "Install it with: sudo dnf install dconf"
require_command python3 "Install it with: sudo dnf install python3"

[[ -f "$BUILT_DIR/metadata.json" ]] || fail "Nothing built yet. Run ./build.sh first."
for file in extension.js upstream-extension.js cursorFollow.js prefs.js; do
    [[ -f "$BUILT_DIR/$file" ]] || fail "The build is incomplete (no $file). Run ./build.sh again."
done
built_uuid="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["uuid"])' "$BUILT_DIR/metadata.json")"
[[ "$built_uuid" == "$UUID" ]] || fail "The build has UUID '$built_uuid', expected '$UUID'."

# The original extension, or an earlier version of this fork, must not run
# alongside: both would record the clipboard and show a panel icon.
if legacy_enabled; then
    fail "$LEGACY_UUID is still enabled. Run ./uninstall-previous-version.sh first."
fi

# ---- Build the new copy in a staging folder --------------------------------

mkdir -p "$WORK_DIR" "$EXTENSIONS_DIR"
STAGE_DIR="$(mktemp -d "$WORK_DIR/staging.XXXXXX")"
MOVED_OLD_COPY=0
INSTALLED_NEW_COPY=0

# On any failure: remove the staging folder and, if the old copy was already
# moved aside but the new one is not in place, put the old copy back.
on_exit() {
    local status=$?
    rm -rf -- "$STAGE_DIR"
    if (( status != 0 && MOVED_OLD_COPY == 1 && INSTALLED_NEW_COPY == 0 )); then
        warn "Installation failed; restoring the previous copy."
        rm -rf -- "$INSTALL_DIR"
        mv -- "$BACKUP_DIR" "$INSTALL_DIR"
    fi
}
trap on_exit EXIT

cp -a -- "$BUILT_DIR/." "$STAGE_DIR/"

# ---- Swap the installed copy -----------------------------------------------

gnome-extensions disable "$UUID" >/dev/null 2>&1 || true

if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf -- "$BACKUP_DIR"
    mv -- "$INSTALL_DIR" "$BACKUP_DIR"
    MOVED_OLD_COPY=1
fi
mv -- "$STAGE_DIR" "$INSTALL_DIR"
INSTALLED_NEW_COPY=1

# ---- Settings ---------------------------------------------------------------

# First install only: switch "Open at mouse pointer" on. An empty dconf read
# means the key has never been set, so a deliberate "off" is never overridden.
if [[ -z "$(dconf read "$CURSOR_FOLLOW_KEY")" ]]; then
    dconf write "$CURSOR_FOLLOW_KEY" true
    say "Switched on 'Open at mouse pointer' (first install)."
fi

# ---- Enable -----------------------------------------------------------------

# On Wayland, GNOME Shell only notices a newly added extension folder at the
# next login, so 'gnome-extensions enable' can fail for a first install. In
# that case the UUID is added to the enabled list directly, and GNOME enables
# the extension when it starts.
enable_at_next_login() {
    python3 - "$UUID" <<'PY'
import ast, subprocess, sys
uuid = sys.argv[1]

def read(key):
    value = subprocess.run(['gsettings', 'get', 'org.gnome.shell', key],
                           capture_output=True, text=True, check=True).stdout.strip()
    return [] if value.startswith('@as') else ast.literal_eval(value)

def write(key, items):
    subprocess.run(['gsettings', 'set', 'org.gnome.shell', key, str(items)], check=True)

enabled = read('enabled-extensions')
if uuid not in enabled:
    write('enabled-extensions', enabled + [uuid])
try:
    disabled = read('disabled-extensions')
    if uuid in disabled:
        write('disabled-extensions', [u for u in disabled if u != uuid])
except subprocess.CalledProcessError:
    pass  # Older GNOME Shell without a disabled-extensions key
PY
}

if ! gnome-extensions enable "$UUID" >/dev/null 2>&1; then
    enable_at_next_login
fi

# ---- Mode: developer tools on or off ------------------------------------------

mkdir -p "$WORK_DIR"
echo "$MODE" > "$MODE_FILE"
if [[ "$MODE" == dev ]]; then
    "$ROOT/upstream-notifications.sh" on
    remote_url="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
    [[ "$remote_url" == git@github.com:* || "$remote_url" == ssh://* ]] \
        || warn "This checkout's origin is not an SSH remote; ./update-test-and-push.sh will refuse to push."
    gnome-shell --help 2>&1 | grep -q -- '--headless' \
        || warn "This GNOME Shell has no --headless mode; the smoke test cannot run here."
else
    "$ROOT/upstream-notifications.sh" off >/dev/null
fi

# ---- Summary ----------------------------------------------------------------

say
say "Installed $UUID ($(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version-name"])' "$INSTALL_DIR/metadata.json")) to:"
say "  $INSTALL_DIR"
if (( MOVED_OLD_COPY == 1 )); then
    say "The copy it replaced is kept in:"
    say "  $BACKUP_DIR"
fi
say "Clipboard history and settings were not changed."
say "Mode: $MODE$([[ "$MODE" == dev ]] && echo " (release notifications on; ./update-test-and-push.sh available)")"
say
say "Log out and back in now. GNOME Shell keeps running the code it loaded"
say "at login until then. Afterwards, check the result with ./verify.sh"
