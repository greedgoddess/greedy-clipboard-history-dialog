# Touch mode

An optional visual mode for touch screens. It is **not installed by
default**: see [installing it](#touch-mode-install-option). Once installed
and switched on (Preferences → Cursor-Follow → **Touch mode**):

- the panel has one fixed size, the same on every tab, and twice the font
  size throughout, including emoji and kaomoji;
- the tab bar at the top (Text, Images, Emoji, Kaomoji, Symbols) is about
  108 px tall, and the clipboard entries are taller, with larger pin and
  delete buttons;
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
`disable()`) and follows the `touch-mode` and `quick-access` settings.

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
places, puts one row of buttons where the first of them was, and applies the
[layout](#touch-mode-layout). Each button
calls `activate()` on its original entry, which runs the original's own
action and closes the panel, as clicking the entry did. The trash can follows
the visibility the original gives its "Clear" entry.

<a id="touch-mode-layout"></a>
## `touch-mode:layout`

All sizes are fixed in `feature/touchMode.css`; nothing is measured or
adjusted while the extension runs. Touch mode adds the class
`greedy-touch-mode` to the panel's box, which gives it:

| What | Size |
| --- | --- |
| Panel | 600 × 820 px, the same on every tab |
| Font | twice the size, throughout (`font-size: 2em`) |
| Tab bar | about 108 px tall (40 px above and below the label) |
| Clipboard entries | 18 px above and below the text; 24 px pin and delete icons |
| Emoji, kaomoji | 40 px and 26 px (the original sets them in pixels) |
| Button row | 36 px icons in buttons of at least 64 × 64 px |

The list takes all the height the other parts leave. On tabs without the
search row, the list gets that row's height, so the panel keeps its size.
To change a size, change it in `touchMode.css` and reinstall.

<a id="touch-mode-unapply"></a>
## `touch-mode:unapply`

Switching touch mode off removes the row, puts the original entries back
where they were, and returns the panel to the original's sizes.

<a id="touch-mode-cleanup"></a>
## `touch-mode:cleanup`

On `disable()`: undoes everything above and unloads the stylesheet.

## Testing

`tests/js/touchMode.test.mjs` covers finding the entries, the button order,
the 1Password button appearing and disappearing with its switch, the buttons
triggering the original entries, the trash can following the original's
visibility, the layout being applied, and putting everything back exactly.
The smoke test loads touch mode switched on.

By hand, on a GNOME desktop (with a touch screen if available):

1. Touch mode off: the panel looks exactly as before.
2. Switch it on: larger text, tall tabs, taller entries; at the bottom, gear
   and trash can buttons replace the two entries. Switch between all five
   tabs: the panel keeps its size.
3. Tap the gear: the preferences open. Tap the trash can: the history is
   cleared except pinned entries, as before. With nothing to clear, the trash
   can is hidden.
4. With the 1Password integration installed and switched on: a 1Password
   button comes first and opens Quick Access at the pointer.
5. Switch touch mode off: everything is back as in step 1.
