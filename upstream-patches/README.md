# Upstream proposal

A proposal to add **Open at mouse pointer** to the original extension,
[Clipboard History](https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history)
by Manouchehr Ghalevand.

**Status: draft, not submitted.**

## Contents of this folder

| File | Purpose |
| --- | --- |
| `0001-add-option-to-open-panel-at-mouse-pointer.patch` | The change, made against the stock release 1.0 (3) |
| `README.md` | This page: checking the patch and the merge-request text |

The patch touches four files:

- the settings schema: one new key, `cursor-follow`, default `false`;
- `prefs.js`: a **Placement** group with one switch;
- `extension.js`: one constant, two methods, one call and one cleanup block;
- `docs/cursor-follow.md`: new; explains each change, and the code comments
  link to it.

With the setting off, which is the default, the extension behaves exactly as
before.

## Checking the patch

Against the stock release, as published on extensions.gnome.org:

```bash
curl -L -o /tmp/stock.zip https://extensions.gnome.org/review/download/77441.shell-extension.zip
rm -rf /tmp/stock && mkdir -p /tmp/stock/src && unzip -oq /tmp/stock.zip -d /tmp/stock/src
cd /tmp/stock && git init -q && git add -A && git commit -qm stock
git apply --check ~/Projects/greedy-clipboard-history-dialog/upstream-patches/0001-add-option-to-open-panel-at-mouse-pointer.patch
```

The stock files are unpacked into `/tmp/stock/src/` so that the layout
matches the paths in the patch.

## Before submitting

1. Test the current code on GNOME Shell 51 with the checklist in
   [docs/cursor-follow.md](../docs/cursor-follow.md#testing).
2. Fork the author's repository on GitHub and clone the fork over SSH.
3. Apply the change there on a new branch, adjusting paths to the author's
   layout, and commit it; `git format-patch` then produces the final patch
   file, and the branch is what the merge request is opened from.
4. Open the merge request with the text below.

## Merge-request text

**Title:** Add option to open the panel at the mouse pointer

**Description:**

This adds an optional setting, **Open at mouse pointer**, which opens the
clipboard panel next to the mouse pointer instead of below the panel icon,
similar to Super+V on Windows. It is off by default, so nothing changes for
existing users.

With the setting on, the panel opens to the right of the pointer, with its
bottom edge level with it. When there is no room on the right, GNOME's own
`BoxPointer` opens it to the left instead. It is most useful with a keyboard
shortcut, since the history then appears where you are working.

How it works: on the menu's `BoxPointer` only, `setPosition()` is routed
through a small method. With the setting off, it calls the original
unchanged. With it on, it points the original at an invisible 1×1 actor
placed at the pointer, with the arrow on the left edge of the panel. All
measuring, keeping the panel on screen, flipping and animation remain
GNOME's. The original method is restored and the actor destroyed in
`destroy()`.

The change:

- adds one boolean key, `cursor-follow`, default `false`;
- adds one switch, in a new **Placement** group in the preferences;
- adds one constant and two methods to `ClipboardHistoryIndicator`, one call
  in `_init()` and one block in `destroy()`;
- writes two private `BoxPointer` fields, `_userArrowSide` and `_arrowSide`,
  because there is no public way to change the arrow side.

Each changed section carries a `[cursor-follow:…]` tag that links to a
chapter of `docs/cursor-follow.md`. Feel free to drop the document and the
tags if you prefer a leaner repository.

Tested on GNOME Shell 51 (Fedora 45, Wayland).
