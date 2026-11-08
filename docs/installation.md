# Installation

This guide covers installing the extension, moving from the previous version
of this fork, updating, checking, and removing it. All commands run from the
root of a checkout of this repository.

## Contents

- [Requirements](#requirements)
- [Getting the code](#getting-the-code)
- [Installing](#installing)
- [Migrating from the previous version](#migrating-from-the-previous-version)
- [Updating](#updating)
- [Checking the installation](#checking-the-installation)
- [Turning Open at mouse pointer on or off](#turning-open-at-mouse-pointer-on-or-off)
- [Uninstalling](#uninstalling)
- [Where things are stored](#where-things-are-stored)
- [Troubleshooting](#troubleshooting)

## Requirements

- GNOME Shell 46 to 51.
- Git, GLib tools, dconf and Python 3. On Fedora:

  ```bash
  sudo dnf install git glib2 dconf python3
  ```

- SSH access to GitHub; see [maintenance.md](maintenance.md#ssh-access).

## Getting the code

```bash
mkdir -p ~/Projects
git clone git@github.com:greedgoddess/greedy-clipboard-history-dialog.git ~/Projects/greedy-clipboard-history-dialog
cd ~/Projects/greedy-clipboard-history-dialog
```

## Installing

```bash
./install.sh
```

Then **log out and back in**. GNOME Shell (on Wayland) only loads extension
code at login; until then it keeps running whatever it loaded before.

What `install.sh` does:

1. Checks that the tools above are present and that `src/` is complete.
2. Stops if version 4 of this fork is installed; see
   [Migrating](#migrating-from-the-previous-version).
3. Asks before replacing a different copy, such as the stock extension.
4. Builds the new copy in a staging folder and compiles its settings schema.
5. Disables the extension, moves the installed copy, if any, to the
   [backup folder](#where-things-are-stored), and moves the new copy into
   place. If anything fails, the previous copy is put back.
6. **First install only:** switches on Open at mouse pointer. If the setting
   has ever been set, on or off, it is left alone.
7. Enables the extension. On a first install GNOME may not know the
   extension until the next login; it is then added to GNOME's list of
   enabled extensions, so it starts at login.

Running `install.sh` again simply reinstalls. Add `--yes` to skip the
questions.

## Migrating from the previous version

Version 4 of this fork had Open at mouse pointer built in, without a setting.
It has to be removed before the current version is installed:

```bash
git pull --ff-only
./uninstall-previous-version.sh
./install.sh
```

Then log out and back in.

`uninstall-previous-version.sh`:

1. Recognises version 4 by its code. If something else is installed, it
   leaves it alone and says so.
2. Asks, then disables and removes it. Clipboard history and settings are
   kept.
3. Lists folders the previous installer left in the extensions folder: its
   backups (`.clipboard-history@manouchehr.backup.*`) and staging folders
   (`.clipboard-history-stage.*`). They only hold old copies of the code, but
   GNOME Shell logs an error for each of them at every login. It asks before
   deleting them.

Because version 4 never stored the setting, `install.sh` treats the
migration as a first install and switches Open at mouse pointer on, so the
behaviour stays the same.

## Updating

```bash
./update.sh
```

This fetches the latest commits from GitHub with `git pull --ff-only` and
runs `install.sh`. It stops without changing anything if the checkout has
uncommitted changes, or if its history has diverged from GitHub. After
updating, log out and back in.

## Checking the installation

```bash
./verify.sh
```

It changes nothing and shows:

- the GNOME Shell version;
- which copy is installed: this version, version 4, another copy, or none;
- whether GNOME has the extension enabled and active;
- whether Open at mouse pointer is on;
- the last GNOME Shell log messages about the extension since boot.

It exits with an error if this version is not the one installed.

## Turning Open at mouse pointer on or off

Open the extension preferences (from the panel menu, **Extension Settings…**,
or the Extensions app) and use **Placement → Open at mouse pointer**. The
change applies the next time the panel opens. For the details and the
equivalent `gsettings` command, see
[cursor-follow.md](cursor-follow.md#cursor-follow-setting).

## Uninstalling

```bash
./uninstall.sh
```

Removes the extension. Clipboard history and settings are kept, so
reinstalling later picks up where you left off.

```bash
./uninstall.sh --purge
```

Also deletes, permanently, the clipboard history, all settings of the
extension, and the installer backup. Both ask before changing anything.
Log out and back in afterwards.

## Where things are stored

| What | Where | Removed by |
| --- | --- | --- |
| Installed extension | `~/.local/share/gnome-shell/extensions/clipboard-history@manouchehr/` | `uninstall.sh` |
| Backup of the copy replaced by the last install | `~/.local/share/greedy-clipboard-history-dialog/backup/` | `uninstall.sh --purge` |
| Clipboard history, including images | `~/.cache/clipboard-history@manouchehr/` | `uninstall.sh --purge` |
| Settings | dconf, `/org/gnome/shell/extensions/clipboard-history/` | `uninstall.sh --purge` |

The settings and history are shared with the stock extension, because both
use the same UUID.

To go back to the copy that was installed before, replace the installed
folder with the backup, then log out and back in:

```bash
gnome-extensions disable clipboard-history@manouchehr
rm -rf ~/.local/share/gnome-shell/extensions/clipboard-history@manouchehr
mv ~/.local/share/greedy-clipboard-history-dialog/backup \
   ~/.local/share/gnome-shell/extensions/clipboard-history@manouchehr
```

## Troubleshooting

### The new behaviour does not appear after installing

Log out and back in. GNOME Shell keeps running the code loaded at login.

### The extension does not appear at all

Run `./verify.sh`. If GNOME does not know the extension, log out and back
in. If it is known but not enabled, check that user extensions are not
switched off globally:

```bash
gsettings get org.gnome.shell disable-user-extensions
```

It should print `false`. The Extensions app has the same switch.

### Errors in the log

Watch GNOME Shell's messages while reproducing the problem:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

### GNOME offers an update for the extension

The fork shares its UUID with the stock extension. GNOME's update check
compares version numbers, and the fork is version 5. If the stock extension
publishes version 6 or higher on extensions.gnome.org, GNOME may offer it as
an update, and accepting would replace the fork. Decline the update until
the fork has been brought up to that release; see
[maintenance.md](maintenance.md#following-a-new-stock-release).

### `install.sh` says the previous fork version is installed

Run `./uninstall-previous-version.sh` first; see
[Migrating](#migrating-from-the-previous-version).
