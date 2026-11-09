#!/usr/bin/env bash
# install.sh — installs the build made by ./build.sh for the current user.
#
# Replaces an installed copy of this extension, keeping one backup of it in
# ~/.local/share/greedy-clipboard-history-dialog/backup/. Never touches the
# clipboard history or existing settings, with one exception: the first time
# it is installed, "Open at mouse pointer" is switched on (later choices in
# the preferences are respected).
#
# Builds first if build/ is empty (the newest tested release, or the newest
# release when none is tested yet).
#
# Optional features are left out unless asked for, and removed again with the
# matching --without-… flag; without either flag, a machine keeps what it has:
#   --with-gestures           three-finger tap and hold gestures
#   --with-password-managers  password manager integration (third-party
#                             apps; 1Password for now). --with-1password and
#                             --without-1password are older names for it.
#   --with-large-spacing   large spacing: taller tabs and icon buttons
#
# Both modes install the same build. --dev makes this a developer machine:
# update notifications then watch Clipboard History releases, and
# ./update-test-and-push.sh may run. --user switches back: notifications
# watch this project's repository. Without either flag, the machine keeps its
# current mode (user on a first install).
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

usage() {
    say "Usage: ./install.sh [--dev | --user] [--yes]"
    say "Installs the build in build/ for the current user, building it first if needed."
    say "  --dev       developer machine: notifications watch Clipboard History"
    say "              releases; ./update-test-and-push.sh may run"
    say "  --user      user machine: notifications watch this project's repository"
    say "  --with-password-managers"
    say "              include the password manager integration (third-party apps;"
    say "              left out by default; kept on later installs)"
    say "  --without-password-managers"
    say "              leave the password manager integration out (the default;"
    say "              --with-1password and --without-1password still work)"
    say "  --with-gestures"
    say "              include the gestures: three-finger tap (touchscreen) and hold"
    say "              (touchpad) to open the panel; each switched on in the preferences"
    say "  --without-gestures"
    say "              leave the gestures out (the default)"
    say "  --with-large-spacing"
    say "              include large spacing (taller tabs, icon buttons; left out by"
    say "              default; kept on later installs)"
    say "  --without-large-spacing"
    say "              leave large spacing out (the default)"
    say "  --allow-untested"
    say "              install a build of a release not in tested-releases.json"
    say "              without asking (--yes alone does not allow that)"
    say "              (without either, the machine keeps its current mode)"
    say "  -y, --yes   answer yes to every question"
}

MODE="$(current_mode)"
ALLOW_UNTESTED=0
# Keep what the installed copy has, unless a flag says otherwise.
# (The password manager integration was the 1Password integration,
# quickAccess, before 1.2.0.)
WITH_PASSWORD_MANAGERS="$(grep -qE '(passwordManagers|quickAccess): true' "$INSTALL_DIR/features.js" 2>/dev/null && echo true || echo false)"
# (Large spacing was called touch mode, touchMode, before 1.2.0.)
WITH_LARGE_SPACING="$(grep -qE '(largeSpacing|touchMode): true' "$INSTALL_DIR/features.js" 2>/dev/null && echo true || echo false)"
WITH_GESTURES="$(grep -q 'gestures: true' "$INSTALL_DIR/features.js" 2>/dev/null && echo true || echo false)"
other_args=()
for arg in "$@"; do
    case "$arg" in
        --dev) MODE=dev ;;
        --user) MODE=user ;;
        --allow-untested) ALLOW_UNTESTED=1 ;;
        --with-password-managers|--with-1password) WITH_PASSWORD_MANAGERS=true ;;
        --without-password-managers|--without-1password) WITH_PASSWORD_MANAGERS=false ;;
        --with-gestures) WITH_GESTURES=true ;;
        --without-gestures) WITH_GESTURES=false ;;
        --with-large-spacing) WITH_LARGE_SPACING=true ;;
        --without-large-spacing) WITH_LARGE_SPACING=false ;;
        *) other_args+=("$arg") ;;
    esac
done
parse_common_options "${other_args[@]+"${other_args[@]}"}"

# ---- Checks before anything is changed -------------------------------------

require_command gnome-extensions "It is part of GNOME Shell."
require_command gsettings "Install it with: sudo dnf install glib2"
require_command dconf "Install it with: sudo dnf install dconf"
require_command python3 "Install it with: sudo dnf install python3"

if [[ ! -f "$BUILT_DIR/metadata.json" ]]; then
    shell_major="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true)"
    if python3 "$ROOT/scripts/upstream.py" tested --shell "$shell_major" >/dev/null 2>&1; then
        say "Nothing built yet; building the newest tested release…"
        "$ROOT/build.sh"
    else
        say "Nothing built yet, and no tested release for this GNOME Shell;"
        say "building the newest release (untested)…"
        "$ROOT/build.sh" --latest
    fi
    say
fi
for file in extension.js upstream-extension.js cursorFollow.js prefs.js; do
    [[ -f "$BUILT_DIR/$file" ]] || fail "The build is incomplete (no $file). Run ./build.sh again."
done
# A build of a release that has not been through ./update-test-and-push.sh is
# installed only on explicit request.
if [[ "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("tested_release", False))' "$BUILT_DIR/build-info.json" 2>/dev/null)" != True ]]; then
    warn "The build in build/ is of a release that is NOT tested (see build/BUILD-INFO)."
    if (( ALLOW_UNTESTED == 0 )); then
        [[ "${ASSUME_YES:-0}" == 1 ]] && fail "Not installing an untested build with --yes alone. Add --allow-untested."
        read -r -p "Install the untested build anyway? [y/N] " answer || answer=""
        [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]] || { say "Cancelled. Nothing was changed."; exit 0; }
    fi
fi
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

# [password-manager:install] [large-spacing:install-option] Include each
# optional feature, or leave its files out entirely.
# See docs/password-managers.md#password-manager-install and
# docs/large-spacing.md#large-spacing-install-option
cat > "$STAGE_DIR/features.js" <<FEATURES
// Written by install.sh; see feature/features.js.
export const FEATURES = {passwordManagers: $WITH_PASSWORD_MANAGERS, largeSpacing: $WITH_LARGE_SPACING, gestures: $WITH_GESTURES};
FEATURES
if [[ "$WITH_GESTURES" != true ]]; then
    rm -f -- "$STAGE_DIR/gestures.js"
fi
if [[ "$WITH_PASSWORD_MANAGERS" != true ]]; then
    rm -f -- "$STAGE_DIR/passwordManagerSwitch.js" "$STAGE_DIR/passwordManagers.js" "$STAGE_DIR/roundedCorners.js"
fi
if [[ "$WITH_LARGE_SPACING" != true ]]; then
    rm -f -- "$STAGE_DIR/largeSpacing.js" "$STAGE_DIR/largeSpacing.css"
fi

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

# ---- Mode, password manager integration and update notifications --------------

# Without the integration, its setting is switched off, so that installing
# it again later starts from off.
# The 1Password switch of before 1.2.0 becomes: 1Password enabled, and opened
# by the second shortcut press. The old key goes.
old_quick_access="$(dconf read "${SETTINGS_PATH}quick-access")"
if [[ -n "$old_quick_access" ]]; then
    if [[ "$old_quick_access" == true ]]; then
        dconf write "${SETTINGS_PATH}password-managers" "['1password']"
        dconf write "${SETTINGS_PATH}shortcut-password-manager" "'1password'"
    fi
    dconf reset "${SETTINGS_PATH}quick-access"
fi
if [[ "$WITH_GESTURES" != true ]]; then
    dconf write "${SETTINGS_PATH}gesture-touchscreen-tap" false
    dconf write "${SETTINGS_PATH}gesture-touchpad-hold" false
fi
if [[ "$WITH_PASSWORD_MANAGERS" != true ]]; then
    dconf write "${SETTINGS_PATH}password-managers" "@as []"
    dconf write "${SETTINGS_PATH}shortcut-password-manager" "''"
fi
# Large spacing was called touch mode before: carry its switch over once. The
# old key only exists until the first install with the new name, so it holds
# the current choice.
old_touch_mode="$(dconf read "${SETTINGS_PATH}touch-mode")"
if [[ -n "$old_touch_mode" ]]; then
    dconf write "${SETTINGS_PATH}large-spacing" "$old_touch_mode"
    dconf reset "${SETTINGS_PATH}touch-mode"
fi
[[ "$WITH_LARGE_SPACING" == true ]] || dconf write "${SETTINGS_PATH}large-spacing" false

# The extension reads these settings; see docs/update-notifications.md.
# GVariant text accepts a JSON string literal for a string value.
gvariant_string() { python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1"; }
dconf write "${SETTINGS_PATH}developer-mode" "$([[ "$MODE" == dev ]] && echo true || echo false)"
dconf write "${SETTINGS_PATH}checkout-path" "$(gvariant_string "$ROOT")"
rm -f -- "$MODE_FILE"
if [[ -z "$(dconf read "${SETTINGS_PATH}update-notifications")" ]]; then
    dconf write "${SETTINGS_PATH}update-notifications" true
    say "Switched on update notifications (first install)."
fi

# An earlier version checked for releases with a systemd timer; the extension
# does that itself now.
OLD_UNIT="greedy-clipboard-history-upstream-check"
OLD_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
if [[ -f "$OLD_UNIT_DIR/$OLD_UNIT.timer" ]]; then
    systemctl --user disable --now "$OLD_UNIT.timer" >/dev/null 2>&1 || true
    rm -f -- "$OLD_UNIT_DIR/$OLD_UNIT.timer" "$OLD_UNIT_DIR/$OLD_UNIT.service"
    systemctl --user daemon-reload 2>/dev/null || true
    say "Removed the old release-check timer (the extension checks itself now)."
fi

if [[ "$MODE" == dev ]]; then
    remote_url="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
    [[ "$remote_url" == git@github.com:* || "$remote_url" == ssh://* ]] \
        || warn "This checkout's origin is not an SSH remote; ./update-test-and-push.sh will refuse to push."
    gnome-shell --help 2>&1 | grep -q -- '--headless' \
        || warn "This GNOME Shell has no --headless mode; the smoke test cannot run here."
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
if [[ "$MODE" == dev ]]; then
    say "Mode: dev. Update notifications watch Clipboard History releases; ./update-test-and-push.sh is available."
else
    say "Mode: user. Update notifications watch this project's repository."
fi
say "Password manager integration: $([[ "$WITH_PASSWORD_MANAGERS" == true ]] && echo "installed (switch password managers on in Preferences → Password managers)" || echo "not installed (add it with --with-password-managers)")"
say "Gestures: $([[ "$WITH_GESTURES" == true ]] && echo "installed (switch them on in Preferences → Gestures)" || echo "not installed (add them with --with-gestures)")"
say "Large spacing: $([[ "$WITH_LARGE_SPACING" == true ]] && echo "installed (switch it on in Preferences → Cursor-Follow)" || echo "not installed (add it with --with-large-spacing)")"
say "Notifications: $([[ "$(dconf read "${SETTINGS_PATH}update-notifications")" == true ]] && echo on || echo off) (Preferences → Cursor-Follow)"
say
say "Log out and back in now. GNOME Shell keeps running the code it loaded"
say "at login until then. Afterwards, check the result with ./verify.sh"
