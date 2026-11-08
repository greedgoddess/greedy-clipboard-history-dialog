#!/usr/bin/env bash
# test_installer.sh — tests install.sh without GNOME: GNOME's tools are
# replaced by stand-ins, and everything happens in a throwaway folder.
# Covers: first install, untested builds, modes, the old extension, and
# rollback when an install is interrupted.
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
UUID="greedy-clipboard-history-dialog@greedgoddess"

SANDBOX="$(mktemp -d)"
trap 'rm -rf -- "$SANDBOX"' EXIT
export HOME="$SANDBOX/home" XDG_DATA_HOME="$SANDBOX/home/.local/share" XDG_CONFIG_HOME="$SANDBOX/home/.config"
unset XDG_CACHE_HOME
mkdir -p "$HOME" "$SANDBOX/bin" "$SANDBOX/repo"
cp -a "$ROOT/install.sh" "$ROOT/scripts" "$SANDBOX/repo/"
REPO="$SANDBOX/repo"
EXT_DIR="$XDG_DATA_HOME/gnome-shell/extensions/$UUID"
DCONF="$SANDBOX/dconf"; touch "$DCONF"

# ---- Stand-ins for GNOME's tools -------------------------------------------------
stub() { printf '#!/usr/bin/env bash\n%s\n' "$2" > "$SANDBOX/bin/$1"; chmod +x "$SANDBOX/bin/$1"; }
stub gnome-extensions 'case "$1" in enable) exit 2;; info) exit 1;; esac; exit 0'
stub gnome-shell 'echo "GNOME Shell 51.1"'
stub systemctl 'exit 0'
stub gsettings 'f="'"$SANDBOX"'/gs-$3"; case "$1" in get) cat "$f" 2>/dev/null || echo "@as []";; set) echo "$4" > "$f";; esac'
stub dconf 'f="'"$DCONF"'"; case "$1" in
  read) grep -F "$2=" "$f" | tail -n1 | cut -d= -f2-;;
  write) grep -vF "$2=" "$f" > "$f.n"; echo "$2=$3" >> "$f.n"; mv "$f.n" "$f";;
esac'
export PATH="$SANDBOX/bin:$PATH"

make_build() {  # make_build TESTED(true/false) MARKER
    rm -rf "$REPO/build"; mkdir -p "$REPO/build/$UUID/schemas"
    for f in extension.js upstream-extension.js cursorFollow.js prefs.js; do echo "// $2" > "$REPO/build/$UUID/$f"; done
    echo "{\"uuid\": \"$UUID\", \"version-name\": \"$2\"}" > "$REPO/build/$UUID/metadata.json"
    echo "{\"tested_release\": $( [[ $1 == true ]] && echo true || echo false )}" > "$REPO/build/$UUID/build-info.json"
}
setting() { grep -F "/org/gnome/shell/extensions/greedy-clipboard-history-dialog/$1=" "$DCONF" | tail -n1 | cut -d= -f2-; }

failures=0
check() { if eval "$2"; then echo "  pass  $1"; else echo "  FAIL  $1"; failures=$((failures + 1)); fi; }
install() { "$REPO/install.sh" "$@" </dev/null >"$SANDBOX/out" 2>&1; }

# ---- Scenarios -------------------------------------------------------------------
make_build true first
install --yes
check "first install of a tested build" '[[ $? -eq 0 && -f "$EXT_DIR/extension.js" ]]'
check "first install switches both settings on" '[[ $(setting cursor-follow) == true && $(setting update-notifications) == true ]]'
check "first install is a user machine" '[[ $(setting developer-mode) == false ]]'

make_build false untested
install --yes
check "untested build refused with --yes alone" '[[ $? -ne 0 ]] && grep -q "// first" "$EXT_DIR/extension.js"'
install --yes --allow-untested
check "untested build installed with --allow-untested" '[[ $? -eq 0 ]] && grep -q "// untested" "$EXT_DIR/extension.js"'

make_build true second
install --dev --yes
check "--dev makes a developer machine" '[[ $(setting developer-mode) == true ]]'
install --yes
check "a plain install keeps the mode" '[[ $(setting developer-mode) == true ]]'
install --user --yes
check "--user switches back" '[[ $(setting developer-mode) == false ]]'

echo "['clipboard-history@manouchehr']" > "$SANDBOX/gs-enabled-extensions"
install --yes
check "refused while the old extension is enabled" '[[ $? -ne 0 ]] && grep -q "uninstall-previous-version" "$SANDBOX/out"'
rm -f "$SANDBOX/gs-enabled-extensions"

# Interrupted install: moving the new copy into place fails.
make_build true third
stub mv 'if [[ "$2" == *staging.* && "$3" == *'"$UUID"' ]]; then exit 1; fi; exec /usr/bin/env -u PATH /bin/mv "$@"'
install --yes
check "interrupted install fails" '[[ $? -ne 0 ]]'
check "interrupted install restores the previous copy" 'grep -q "// second" "$EXT_DIR/extension.js"'
check "interrupted install leaves no staging folder" '! ls "$XDG_DATA_HOME/greedy-clipboard-history-dialog" | grep -q staging'
rm -f "$SANDBOX/bin/mv"

(( failures == 0 ))
