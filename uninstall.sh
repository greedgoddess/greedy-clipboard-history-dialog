#!/usr/bin/env bash
set -euo pipefail
UUID="clipboard-history@manouchehr"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "This removes the installed personal fork, but keeps:"
echo "  - clipboard history in ~/.cache/$UUID/"
echo "  - GNOME extension settings"
read -r -p "Uninstall the extension files? [y/N] " answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) echo "Cancelled."; exit 0 ;;
esac

gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
if [[ -d "$DEST" ]]; then
  rm -rf -- "$DEST"
fi
echo "Extension files removed. Clipboard history and settings were preserved."
