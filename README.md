# Clipboard History — Personal Fedora Fork

This is a personal fork of [M-ghalevand's GNOME Clipboard History extension](https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history), exported from the known-working local installation rather than rebuilt from upstream `master`.

## Why export from the installed copy?

The upstream GitHub `master` README/source currently describes GNOME Shell 46–50, while the installed GNOME Extensions release 1.0 (3) was reviewed with GNOME Shell 51 support. The working local installation is therefore the source of truth for this fork. See the upstream repository and the GNOME Extensions version listing before merging upstream changes.

## Personal changes included

- Clipboard popup anchored to the current pointer position.
- Preferred placement is to the **right** of the cursor.
- Popup bottom edge is aligned with the cursor.
- GNOME `BoxPointer` preferred arrow side is set to `St.Side.LEFT`; native flip behavior can move the popup to the left when there is insufficient room on the right.
- Correct cleanup restores the original `setPosition` method.
- Panel icon uses `edit-copy-symbolic`.
- Temporary debugging notifications/logging are stripped during export.

The extension retains the original UUID `clipboard-history@manouchehr`. This intentionally replaces the upstream installation rather than installing a second side-by-side copy. It also preserves the original GSettings schema and cache location, so settings and local clipboard history remain intact.

## 1. Export the working installation on the first Fedora system

Extract the toolkit ZIP, then run:

```bash
chmod +x ./*.sh
./bootstrap-fork.sh
```

By default this creates:

```text
~/Projects/clipboard-history-personal/
```

You can provide another destination:

```bash
./bootstrap-fork.sh "$HOME/Projects/my-clipboard-fork"
```

The exporter checks that the tested cursor patch is present and refuses to export if the deliberate syntax-error test line is present. It copies the currently installed extension into `src/`, removes the compiled schema cache, cleans up temporary diagnostics, and marks the metadata as version 4 / Personal Fork.

## 2. Put the fork under Git

```bash
cd ~/Projects/clipboard-history-personal
git init
git add .
git commit -m "Create personal Clipboard History fork"
```

Create an **empty** private GitHub repository (for example `clipboard-history-personal`), then connect and push it:

```bash
git branch -M main
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/clipboard-history-personal.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your GitHub account name. You can use an HTTPS remote instead of SSH if preferred.

If you want the extension's metadata URL to point to your fork, edit `src/metadata.json` and change its `url` field to your repository URL, then commit and push that change.

## 3. Install on the second Fedora system

Install Git if necessary:

```bash
sudo dnf install git glib2
```

Clone your personal repository:

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone git@github.com:YOUR_GITHUB_USERNAME/clipboard-history-personal.git
cd clipboard-history-personal
```

Install:

```bash
chmod +x ./*.sh
./install.sh
```

The installer:
- verifies the extension UUID and personal positioning patch;
- disables the existing extension if present;
- compiles the GSettings schema locally;
- keeps a timestamped backup of any existing installation;
- installs under `~/.local/share/gnome-shell/extensions/clipboard-history@manouchehr`;
- enables the extension;
- does not delete the clipboard history cache or GNOME settings.

On a fresh second system, the panel icon should appear after enabling. If you are replacing an already-loaded copy and GNOME Shell does not pick up the new JavaScript under Wayland, log out and back in.

## 4. Update later

After pushing changes from the first machine:

```bash
cd ~/Projects/clipboard-history-personal
./update.sh
```

This performs a fast-forward-only `git pull` and reinstalls the fork.

## 5. Verify

```bash
./verify.sh
```

Check extension state:

```bash
gnome-extensions info clipboard-history@manouchehr
```

Watch GNOME Shell logs for extension errors:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## 6. Uninstall

```bash
./uninstall.sh
```

This removes the installed extension files but deliberately preserves:
- `~/.cache/clipboard-history@manouchehr/` (clipboard history and image cache);
- the extension's GSettings values.

To reinstall, run `./install.sh` from the fork checkout.

## Important notes

- Fedora's `glib2` package provides `glib-compile-schemas`.
- The extension's UUID remains the upstream UUID. Do not change it unless you also intentionally migrate the schema ID, settings path, cache path, and extension references.
- Do not install the upstream copy alongside this fork under the same UUID.
- The original extension is licensed GPL-2.0-or-later. Keep its `LICENSE` and copyright notices when redistributing.
- Clipboard history is local to each machine; this installer does not copy clipboard contents between systems.

## Upstream

- Source: https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history
- GNOME Extensions: https://extensions.gnome.org/extension/10613/clipboard-history/
