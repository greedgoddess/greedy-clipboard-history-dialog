# Greedy Clipboard History Dialog

A personal fork of
[Clipboard History](https://extensions.gnome.org/extension/10613/clipboard-history/)
by Manouchehr Ghalevand, a Windows-style clipboard history panel for GNOME
Shell.

It is the stock extension, release 1.0 (3), with one addition:

**Open at mouse pointer.** An optional setting that opens the panel next to
the mouse pointer instead of below its panel icon: to the right of the
pointer, with its bottom edge level with it, or to the left when there is no
room on the right. Switch it on or off in the extension preferences, under
**Placement**.

Everything else is unchanged from the stock release. The addition is written
so that it can be proposed to the original author; see
[Upstream proposal](#upstream-proposal).

## Quick start

All commands run from a checkout of this repository. GitHub is accessed over
SSH (see [docs/maintenance.md](docs/maintenance.md#ssh-access)).

**New machine:**

```bash
git clone git@github.com:greedgoddess/greedy-clipboard-history-dialog.git ~/Projects/greedy-clipboard-history-dialog
cd ~/Projects/greedy-clipboard-history-dialog
./install.sh
```

**Machine with the previous version of this fork (version 4):**

```bash
cd ~/Projects/greedy-clipboard-history-dialog
git pull --ff-only
./uninstall-previous-version.sh
./install.sh
```

**Later updates:**

```bash
cd ~/Projects/greedy-clipboard-history-dialog
./update.sh
```

After installing or updating, **log out and back in**, then run `./verify.sh`.

The scripts never delete your clipboard history or settings unless you ask
for it with `./uninstall.sh --purge`.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/installation.md](docs/installation.md) | Installing, migrating from version 4, updating, checking, uninstalling, troubleshooting |
| [docs/cursor-follow.md](docs/cursor-follow.md) | How Open at mouse pointer works, section by section, linked from the code |
| [docs/maintenance.md](docs/maintenance.md) | Git and SSH, comparing with the stock release, following new stock releases |
| [upstream-patches/README.md](upstream-patches/README.md) | The proposal for the original author: patch, how to check it, merge-request text |

## Repository layout

```text
src/                            The extension, as installed
  extension.js                  Panel, menu and Open at mouse pointer
  prefs.js                      Preferences window
  schemas/                      Settings schema
  metadata.json                 Name, UUID, version, supported GNOME versions
docs/                           Documentation
upstream-patches/               Proposal for the original author
scripts/common.sh               Shared settings for the scripts below
install.sh                      Install or reinstall
uninstall.sh                    Remove (optionally with history and settings)
uninstall-previous-version.sh   Remove version 4 of this fork before installing
update.sh                       git pull, then install
verify.sh                       Show what is installed and whether it works
```

## How this fork differs from the stock release

| File | Difference |
| --- | --- |
| `src/extension.js` | Open at mouse pointer: one constant, two methods, one call, one cleanup block, all tagged `[cursor-follow:…]` |
| `src/prefs.js` | **Placement** group with the **Open at mouse pointer** switch |
| `src/schemas/…gschema.xml` | `cursor-follow` key |
| `src/metadata.json` | Fork name, version 5, version name `1.0+cursor-follow` |

To check this against the stock release yourself, see
[docs/maintenance.md](docs/maintenance.md#comparing-with-the-stock-release).

## Why the UUID is unchanged

The fork keeps the stock UUID, `clipboard-history@manouchehr`. This makes it
a drop-in replacement: it uses the same settings and the same clipboard
history (`~/.cache/clipboard-history@manouchehr/`). The flip side is that the
fork and the stock extension cannot be installed side by side, and GNOME may
offer to replace the fork once the stock extension publishes a version higher
than 5; see [docs/installation.md](docs/installation.md#gnome-offers-an-update-for-the-extension).

## Upstream proposal

Open at mouse pointer is prepared as a patch for the original extension,
switched off by default so that it changes nothing for existing users. The
proposal is a **draft** and has not been submitted. Until the author decides,
this fork is the way to use the feature.

## Credits and license

Clipboard History is © 2025 Manouchehr Ghalevand, licensed under
GPL-2.0-or-later; see [src/LICENSE](src/LICENSE). The additions in this fork
are under the same license.
