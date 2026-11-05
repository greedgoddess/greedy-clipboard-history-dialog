#!/usr/bin/env bash
set -u
UUID="clipboard-history@manouchehr"
FILE="$HOME/.local/share/gnome-shell/extensions/$UUID/extension.js"

echo "===== SHELL ====="
gnome-shell --version
echo
echo "===== EXTENSION ====="
gnome-extensions info "$UUID" | tail -8
echo
echo "===== PATCH CHECKS ====="
if [[ ! -f "$FILE" ]]; then
  echo "Missing installed extension.js"
  exit 1
fi
grep -nE '_cursorAnchor|_userArrowSide|_arrowAlignment|_originalSetPosition' "$FILE"
echo
if grep -q '^THIS_IS_NOT_VALID_JAVASCRIPT;$' "$FILE"; then
  echo "FAIL: test syntax-error line remains"
  exit 1
fi
echo "No deliberate syntax-error test line found."
