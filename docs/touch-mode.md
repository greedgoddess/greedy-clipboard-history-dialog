# Touch mode

An optional visual mode for touch screens. It is **not installed by
default**: see [installing it](#touch-mode-install-option). Once installed
and switched on (Preferences → Cursor-Follow → **Touch mode**):

- the tab bar at the top (Text, Images, Emoji, Kaomoji, Symbols) is twice as
  tall; the text keeps its size, so the panel keeps its width;
- the menu entries at the bottom are replaced by a row of icon buttons:
  optional entries first, then **settings** (gear) and **clear** (trash
  can). With the [1Password integration](quick-access.md) installed and
  switched on, a **1Password** button, with 1Password's app icon, opens Quick
  Access the same way as the second press of the shortcut.

The buttons trigger the original entries, so settings and clearing behave
exactly as before; the trash can, like "Clear (except pinned)", only shows
when there is something to clear.

The code is in `feature/touchMode.js` and `feature/touchMode.css`; each
section starts with a tag:

```bash
grep -rn "\[touch-mode:" feature/ install.sh
```

<a id="touch-mode-install-option"></a>
## `touch-mode:install-option`

```bash
./install.sh --with-touch-mode      # include touch mode
./install.sh --without-touch-mode   # leave it out again (the default)
```

Without `--with-touch-mode`, `install.sh` leaves `touchMode.js` and
`touchMode.css` out of the installed copy and records `touchMode: false` in
its `features.js`. The choice is independent of the 1Password integration,
kept by later installs and updates until changed, and removing touch mode
also switches its setting off. `./verify.sh` shows whether it is installed.

<a id="touch-mode-setting"></a>
## `touch-mode:setting`

Boolean key `touch-mode` in `feature/settings-keys.xml`, default `false`.
It applies at once, without reopening anything.

<a id="touch-mode-preference"></a>
## `touch-mode:preference`

The **Touch mode** switch in the Cursor-Follow group, shown only when touch
mode is installed.

<a id="touch-mode-entry-point"></a>
## `touch-mode:entry-point`

When `features.js` says touch mode is installed, `feature/extension.js` loads
`touchMode.js` with a dynamic `import()` and creates `TouchMode` with the
panel menu, the settings, the stylesheet, and a way to reach the 1Password
integration if it is loaded. It is destroyed on `disable()`.

<a id="touch-mode-install"></a>
## `touch-mode:install`

`TouchMode` loads `touchMode.css` into GNOME Shell's theme (unloaded again on
`disable()`), follows the `touch-mode` and `quick-access` settings, and
enlarges the tabs whenever the panel opens in touch mode.

<a id="touch-mode-find-actions"></a>
## `touch-mode:find-actions`

`findMenuActions()` finds the original's two entries among the menu's items
by their labels, "Extension Settings…" and "Clear (except pinned)". If a
release renames them, touch mode stays inactive and logs a warning, and
`build.sh` warns already when building that release.

<a id="touch-mode-button-order"></a>
## `touch-mode:button-order`

`orderButtons()`: optional entries first (1Password, when available), then
settings, then clear.

<a id="touch-mode-apply"></a>
## `touch-mode:apply`

Takes the two original entries out of the menu, keeping them and their
places, and puts one row of buttons where the first of them was. Each button
calls `activate()` on its original entry, which runs the original's own
action and closes the panel, as clicking the entry did. The trash can follows
the visibility the original gives its "Clear" entry.

<a id="touch-mode-tabs"></a>
## `touch-mode:tabs`

The first time the panel opens in touch mode, each tab's natural height is
measured; every tab is then set to exactly twice that.

<a id="touch-mode-unapply"></a>
## `touch-mode:unapply`

Switching touch mode off removes the row, puts the original entries back
where they were, and returns the tabs to their natural height.

<a id="touch-mode-cleanup"></a>
## `touch-mode:cleanup`

On `disable()`: undoes everything above and unloads the stylesheet.

## Testing

`tests/js/touchMode.test.mjs` covers finding the entries, the button order,
the 1Password button appearing and disappearing with its switch, the buttons
triggering the original entries, the trash can following the original's
visibility, doubling the tab height, and putting everything back exactly.
The smoke test loads touch mode switched on.

By hand, on a GNOME desktop (with a touch screen if available):

1. Touch mode off: the panel looks exactly as before.
2. Switch it on: the tabs are twice as tall; at the bottom, gear and trash
   can buttons replace the two entries.
3. Tap the gear: the preferences open. Tap the trash can: the history is
   cleared except pinned entries, as before. With nothing to clear, the trash
   can is hidden.
4. With the 1Password integration installed and switched on: a 1Password
   button comes first and opens Quick Access at the pointer.
5. Switch touch mode off: everything is back as in step 1.
