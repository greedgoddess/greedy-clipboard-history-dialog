# shellcheck shell=bash
# sandbox.sh — sourced by the script tests. Creates a throwaway home folder
# and a copy of the repository's scripts, and replaces GNOME's tools with
# stand-ins that keep their state in files: gnome-extensions, gnome-shell,
# gsettings, dconf (read, write, dump, load, reset -f) and systemctl.

SANDBOX="$(mktemp -d)"
trap 'rm -rf -- "$SANDBOX"' EXIT
export HOME="$SANDBOX/home" XDG_DATA_HOME="$SANDBOX/home/.local/share"
export XDG_CONFIG_HOME="$SANDBOX/home/.config" XDG_CACHE_HOME="$SANDBOX/home/.cache"
mkdir -p "$HOME" "$SANDBOX/bin" "$SANDBOX/repo"
cp -a "$ROOT/install.sh" "$ROOT/uninstall.sh" "$ROOT/uninstall-previous-version.sh" "$ROOT/scripts" "$SANDBOX/repo/"
REPO="$SANDBOX/repo"

UUID="greedy-clipboard-history-dialog@greedgoddess"
LEGACY_UUID="clipboard-history@manouchehr"
EXTENSIONS="$XDG_DATA_HOME/gnome-shell/extensions"
EXT_DIR="$EXTENSIONS/$UUID"
LEGACY_EXT_DIR="$EXTENSIONS/$LEGACY_UUID"
HISTORY="$XDG_CACHE_HOME/$UUID"
LEGACY_HISTORY="$XDG_CACHE_HOME/$LEGACY_UUID"
NEW_PATH="/org/gnome/shell/extensions/greedy-clipboard-history-dialog/"
OLD_PATH="/org/gnome/shell/extensions/clipboard-history/"
export SANDBOX

stub() { printf '#!/usr/bin/env bash\n%s\n' "$2" > "$SANDBOX/bin/$1"; chmod +x "$SANDBOX/bin/$1"; }
# gnome-extensions: "info" knows only extensions listed in $SANDBOX/known.
stub gnome-extensions 'case "$1" in
  enable) exit 2;;
  disable) echo "$2" >> "$SANDBOX/disabled";;
  info) grep -qx "$2" "$SANDBOX/known" 2>/dev/null || exit 1; echo "  Enabled: Yes";;
esac; exit 0'
stub gnome-shell 'echo "GNOME Shell 51.1"'
stub systemctl 'exit 0'
stub gsettings 'f="$SANDBOX/gs-$3"; case "$1" in get) cat "$f" 2>/dev/null || echo "@as []";; set) echo "$4" > "$f";; esac'
cat > "$SANDBOX/bin/dconf" <<'PY'
#!/usr/bin/env python3
import json, os, sys
store_file = os.path.join(os.environ['SANDBOX'], 'dconf.json')
store = json.load(open(store_file)) if os.path.exists(store_file) else {}
command, args = sys.argv[1], sys.argv[2:]
if command == 'read':
    print(store.get(args[0], ''))
elif command == 'write':
    store[args[0]] = args[1]
elif command == 'dump':
    keys = sorted(k for k in store if k.startswith(args[0]))
    if keys:
        print('[/]')
        for k in keys:
            print(f'{k[len(args[0]):]}={store[k]}')
elif command == 'load':
    for line in sys.stdin.read().splitlines():
        if '=' in line and not line.startswith('['):
            key, value = line.split('=', 1)
            store[args[0] + key] = value
elif command == 'reset' and args[0] == '-f':
    store = {k: v for k, v in store.items() if not k.startswith(args[1])}
elif command == 'reset':
    store.pop(args[0], None)
json.dump(store, open(store_file, 'w'))
PY
chmod +x "$SANDBOX/bin/dconf"
export PATH="$SANDBOX/bin:$PATH"

setting() { dconf read "$1$2"; }

failures=0
check() {
    if eval "$2"; then echo "  pass  $1"; else echo "  FAIL  $1"; failures=$((failures + 1)); fi
}
run() { "$@" </dev/null >"$SANDBOX/out" 2>&1; }

# A minimal build in the copied repository; make_build TESTED MARKER
make_build() {
    rm -rf "$REPO/build"; mkdir -p "$REPO/build/$UUID/schemas"
    for f in extension.js upstream-extension.js cursorFollow.js prefs.js hoverPreview.js hoverPreview.css privateHistory.js clearAtLogin.js gestures.js \
             passwordManagerSwitch.js passwordManagers.js roundedCorners.js \
             largeSpacing.js largeSpacing.css; do
        echo "// $2" > "$REPO/build/$UUID/$f"
    done
    echo "export const FEATURES = {passwordManagers: false, largeSpacing: false, gestures: false};" > "$REPO/build/$UUID/features.js"
    echo "{\"uuid\": \"$UUID\", \"version-name\": \"$2\"}" > "$REPO/build/$UUID/metadata.json"
    echo "{\"tested_release\": $1}" > "$REPO/build/$UUID/build-info.json"
}
