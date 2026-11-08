# greedy-clipboard-history-dialog

![License: GPL-2.0-or-later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)
![Status: personal fork](https://img.shields.io/badge/status-personal%20fork-orange)

**Clipboard History for GNOME Shell, with an option to open the panel at the mouse pointer.**

This is [Clipboard History](https://extensions.gnome.org/extension/10613/clipboard-history/)
by Manouchehr Ghalevand, release 1.0 (3), with one added setting:
**Open at mouse pointer**, under **Placement** in the extension preferences.
With it on, the panel opens to the right of the pointer with its bottom edge
level with it, or to the left when there is no room on the right. With it
off, the panel opens below its icon as usual.

- **Personal fork.** Used on Fedora 45 with GNOME Shell 51. The stock
  extension supports GNOME Shell 46 to 51.
- **Replaces the stock extension.** It keeps the stock UUID,
  `clipboard-history@manouchehr`, so it uses the same settings and clipboard
  history, and the two can't be installed side by side.

The added setting was written largely by an AI assistant (Claude, by
Anthropic), directed and tested by the author. It has had no independent
review.

## Changes from the stock release

| File | Change |
| --- | --- |
| `src/extension.js` | Open at mouse pointer |
| `src/prefs.js` | **Placement → Open at mouse pointer** switch |
| `src/schemas/…gschema.xml` | `cursor-follow` key, off by default |
| `src/metadata.json` | Name, version 5 |

Each changed section is tagged `[cursor-follow:…]` in the code and explained
in [docs/cursor-follow.md](docs/cursor-follow.md).

## Install

```bash
git clone git@github.com:greedgoddess/greedy-clipboard-history-dialog.git
cd greedy-clipboard-history-dialog
./install.sh
```

Log out and back in, then check with `./verify.sh`. The first install
switches **Open at mouse pointer** on.

**Coming from version 4** (pointer placement built in, no setting): run
`./uninstall-previous-version.sh` before `./install.sh`.

**Update:** `./update.sh`, then log out and back in.

**Uninstall:** `./uninstall.sh`. Clipboard history and settings are kept;
`./uninstall.sh --purge` deletes them too.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No change after installing or updating | Log out and back in; GNOME Shell only loads extension code at login |
| `install.sh` reports the previous version | Run `./uninstall-previous-version.sh` first |
| Extension missing after logging in | Run `./verify.sh`; `gsettings get org.gnome.shell disable-user-extensions` must print `false` |
| GNOME offers an update for Clipboard History | Decline it: a stock release would replace the fork |
| Anything else | `journalctl -f -o cat /usr/bin/gnome-shell` |

## License

GPL-2.0-or-later, like the stock extension; see [src/LICENSE](src/LICENSE).
Clipboard History is © 2025 Manouchehr Ghalevand.
