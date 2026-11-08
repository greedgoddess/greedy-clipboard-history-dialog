# Open at mouse pointer: code notes

Notes for each tagged section of the **Open at mouse pointer** setting. Each
section in the source starts with a comment holding its tag, for example
`[cursor-follow:positioning]`, and a link to its chapter here.

```bash
grep -rn "\[cursor-follow:" src/
```

| Tag | File |
| --- | --- |
| [`cursor-follow:setting`](#cursor-follow-setting) | `schemas/org.gnome.shell.extensions.clipboard-history.gschema.xml` |
| [`cursor-follow:preference`](#cursor-follow-preference) | `prefs.js` |
| [`cursor-follow:arrow-alignment`](#cursor-follow-arrow-alignment) | `extension.js` |
| [`cursor-follow:install`](#cursor-follow-install) | `extension.js` |
| [`cursor-follow:positioning`](#cursor-follow-positioning) | `extension.js` |
| [`cursor-follow:cleanup`](#cursor-follow-cleanup) | `extension.js` |

No other code differs from the stock release.

<a id="cursor-follow-setting"></a>
## `cursor-follow:setting`

Boolean key `cursor-follow`, default `false`: the panel opens below its icon
unless the user switches the setting on. It is read each time the panel
opens, so it needs no change handler.

<a id="cursor-follow-preference"></a>
## `cursor-follow:preference`

A **Placement** group in `fillPreferencesWindow()` with one `Adw.SwitchRow`,
**Open at mouse pointer**, bound to the key with `settings.bind()`.

<a id="cursor-follow-arrow-alignment"></a>
## `cursor-follow:arrow-alignment`

`POINTER_ARROW_ALIGNMENT = 1.0` places the arrow at the bottom of the panel's
left edge (`0.0` is the top). The pointer then touches the panel's
bottom-left corner, so the bottom edge is level with the pointer, within the
few pixels the arrow keeps clear of the rounded corner.

<a id="cursor-follow-install"></a>
## `cursor-follow:install`

`_installCursorFollow()`, called once from `_init()` after `_buildMenu()`:

- adds a 1×1, transparent, non-reactive `St.Widget` to `Main.uiGroup` as the
  pointer anchor, because `BoxPointer.setPosition()` points at an actor, not
  at coordinates;
- saves the menu's original `BoxPointer.setPosition` and its arrow side
  (`St.Side.TOP`), then replaces `setPosition` on that instance with a call
  to `_positionMenu()`.

The hook is installed whether the setting is on or off, so switching it needs
no extra code.

<a id="cursor-follow-positioning"></a>
## `cursor-follow:positioning`

`_positionMenu()` runs each time the panel opens, where `PopupMenu.open()`
would call `BoxPointer.setPosition(sourceActor, alignment)`.

- **Off:** restores the saved arrow side and calls the original with the
  original arguments. Same result as the stock extension.
- **On:** moves the anchor to `global.get_pointer()`, sets the arrow side to
  `St.Side.LEFT`, and calls the original with the anchor and
  `POINTER_ARROW_ALIGNMENT`. An arrow on the left edge puts the panel to the
  right of the pointer. When that does not fit, `BoxPointer` flips it to the
  left by itself, and it keeps the panel on the anchor's monitor.

The original `setPosition()` is called rather than reimplemented, so GNOME
keeps tracking the source actor as it normally does.

Private API: `BoxPointer` has no public setter for the arrow side, so two
private fields are written. `_userArrowSide` is the preferred side, which
GNOME flips away from when space runs out. `_arrowSide` is the side in use,
which also sets the direction of the opening animation. The menu's
`_boxPointer` is itself private. If placement breaks after a GNOME upgrade,
check these names in GNOME Shell's `js/ui/boxpointer.js` first.

<a id="cursor-follow-cleanup"></a>
## `cursor-follow:cleanup`

In `destroy()`, which runs when the extension is disabled (including on
screen lock), before `super.destroy()`: restores the original
`setPosition` and destroys the anchor. Both steps are guarded and clear
their references.
