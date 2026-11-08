# Open at mouse pointer (`cursor-follow`)

**Open at mouse pointer** is an optional setting that makes the clipboard
history panel open next to the mouse pointer instead of below its panel icon.
It is **off by default**; with it off, the extension behaves exactly as
before.

With the setting on, the panel:

- opens to the **right** of the pointer;
- has its **bottom edge level with the pointer**, so it extends upwards;
- opens to the **left** of the pointer instead when there is not enough room
  on the right;
- stays on the monitor the pointer is on.

Changes to the setting apply the next time the panel opens. The setting is
most useful together with a keyboard shortcut, because the history then
appears where you are working, much like Super+V on Windows.

## Contents

- [Where the code is](#where-the-code-is)
- [How GNOME positions a panel menu](#how-gnome-positions-a-panel-menu)
- Code sections, in the order they are encountered:
  - [`cursor-follow:setting`](#cursor-follow-setting): the on/off setting
  - [`cursor-follow:preference`](#cursor-follow-preference): the switch in the preferences
  - [`cursor-follow:arrow-alignment`](#cursor-follow-arrow-alignment): bottom edge level with the pointer
  - [`cursor-follow:install`](#cursor-follow-install): the pointer anchor and the hook
  - [`cursor-follow:positioning`](#cursor-follow-positioning): choosing where the panel opens
  - [`cursor-follow:cleanup`](#cursor-follow-cleanup): undoing the hook
- [Private GNOME API used](#private-gnome-api-used)
- [Testing](#testing)

## Where the code is

Each code section of this feature starts with a comment holding a tag in
square brackets, for example `[cursor-follow:positioning]`, followed by a link
to the chapter of the same name below. To list all of them:

```bash
grep -rn "\[cursor-follow:" src/
```

| Tag | File | Section |
| --- | --- | --- |
| `cursor-follow:setting` | `schemas/org.gnome.shell.extensions.clipboard-history.gschema.xml` | `cursor-follow` key |
| `cursor-follow:preference` | `prefs.js` | "Placement" group in `fillPreferencesWindow()` |
| `cursor-follow:arrow-alignment` | `extension.js` | `POINTER_ARROW_ALIGNMENT` constant |
| `cursor-follow:install` | `extension.js` | `ClipboardHistoryIndicator._installCursorFollow()` and its call in `_init()` |
| `cursor-follow:positioning` | `extension.js` | `ClipboardHistoryIndicator._positionMenu()` |
| `cursor-follow:cleanup` | `extension.js` | block in `ClipboardHistoryIndicator.destroy()` |

No other code is changed.

## How GNOME positions a panel menu

A panel menu is drawn inside a `BoxPointer`: the rounded box with a small
arrow pointing at whatever opened it. Each time the menu opens,
`PopupMenu.open()` calls

```js
this._boxPointer.setPosition(sourceActor, alignment);
```

where `sourceActor` is the panel icon. The `BoxPointer` then places itself so
that its arrow touches that actor. Which edge of the box carries the arrow is
the *arrow side*; for panel menus it is `St.Side.TOP`, so the menu hangs below
the icon. If the box does not fit on the monitor with that side, the
`BoxPointer` moves the arrow to the opposite side by itself.

This feature changes only two inputs to that process: **what** the arrow
points at (the pointer instead of the icon) and **which edge** carries it
(left instead of top). Measuring, keeping the box on screen, flipping and
the opening animation all remain GNOME's.

---

<a id="cursor-follow-setting"></a>
## `cursor-follow:setting` — the on/off setting

**File:** `schemas/org.gnome.shell.extensions.clipboard-history.gschema.xml`

A boolean key named `cursor-follow`, default `false`, so that nothing changes
for existing users until they switch it on. The extension reads it each time
the panel opens (see [positioning](#cursor-follow-positioning)), so it needs
no change handler.

It can also be set from a terminal. The schema ships with the extension
rather than system-wide, so `gsettings` needs to be pointed at it:

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/clipboard-history@manouchehr/schemas \
  set org.gnome.shell.extensions.clipboard-history cursor-follow true
```

<a id="cursor-follow-preference"></a>
## `cursor-follow:preference` — the switch in the preferences

**File:** `prefs.js`, in `fillPreferencesWindow()`

A new group, **Placement**, holding one `Adw.SwitchRow` titled
**Open at mouse pointer**. It is bound to the setting with `settings.bind()`,
exactly like the existing **Save copied images** switch. It has a group of
its own because it concerns where the panel appears, not the history.

<a id="cursor-follow-arrow-alignment"></a>
## `cursor-follow:arrow-alignment` — bottom edge level with the pointer

**File:** `extension.js`, constants section

```js
const POINTER_ARROW_ALIGNMENT = 1.0;
```

The second argument of `setPosition()` says where along its edge the arrow
sits, from `0.0` to `1.0`. The arrow is on the left edge here, so `0.0` is
the top of that edge and `1.0` the bottom. At `1.0` the pointer touches the
panel near its bottom-left corner, which puts the bottom edge level with the
pointer and makes the panel extend upwards. The arrow stays a few pixels
clear of the rounded corner, so "level" means within those few pixels.

The value is a named constant so that its purpose is clear where it is used.

<a id="cursor-follow-install"></a>
## `cursor-follow:install` — the pointer anchor and the hook

**File:** `extension.js`, `ClipboardHistoryIndicator._installCursorFollow()`,
called once from `_init()` right after `_buildMenu()`

1. **Pointer anchor.** `setPosition()` points at an actor, not at
   coordinates. A 1×1, fully transparent, non-reactive `St.Widget` is added
   to `Main.uiGroup` to serve as that actor; it is moved to the pointer each
   time the panel opens. Being non-reactive, it never receives clicks or
   focus. Because it sits on the pointer's monitor, the `BoxPointer` also
   uses that monitor.
2. **Hook.** On this menu's `BoxPointer` only, `setPosition` is replaced by a
   small function that calls [`_positionMenu()`](#cursor-follow-positioning).
   The original method and the panel's own arrow side (`St.Side.TOP`) are
   saved first, so they can be used while the setting is off and restored
   when the extension is [disabled](#cursor-follow-cleanup).

The hook is installed whether the setting is on or off. Switching the setting
therefore needs no extra code: the next time the panel opens, `_positionMenu()`
simply takes the other branch.

<a id="cursor-follow-positioning"></a>
## `cursor-follow:positioning` — choosing where the panel opens

**File:** `extension.js`, `ClipboardHistoryIndicator._positionMenu()`

Runs each time the panel opens, in place of `BoxPointer.setPosition()`.

**Setting off.** The panel's own arrow side is put back and the original
`setPosition()` is called with the original arguments. The result is
identical to the extension without this feature.

**Setting on.**

1. `global.get_pointer()` returns the pointer position, and the
   [anchor](#cursor-follow-install) is moved there.
2. The arrow side is set to `St.Side.LEFT`. An arrow on the panel's left edge
   points left, at the pointer, so the panel is to the **right** of the
   pointer.
3. The original `setPosition()` is called with the anchor and
   [`POINTER_ARROW_ALIGNMENT`](#cursor-follow-arrow-alignment).

Opening to the left of the pointer when there is no room on the right is not
implemented here. It is what every `BoxPointer` does when its preferred side
does not fit.

The original `setPosition()` is called, rather than its fields being set by
hand, because it does more than store the actor and alignment: current GNOME
versions also stop following the previous actor and watch the new one for
destruction. Calling it keeps that behaviour and limits the private fields
this feature writes to the two described under
[Private GNOME API used](#private-gnome-api-used).

<a id="cursor-follow-cleanup"></a>
## `cursor-follow:cleanup` — undoing the hook

**File:** `extension.js`, `ClipboardHistoryIndicator.destroy()`

The indicator is destroyed whenever the extension is disabled, which includes
every screen lock. Before `super.destroy()` destroys the menu, this block:

- puts the saved original `setPosition` back on the `BoxPointer`;
- destroys the anchor, which also removes it from `Main.uiGroup`.

Both steps check that there is something to undo and clear their references,
so the block is safe in any state.

## Private GNOME API used

`BoxPointer` offers no public way to change its arrow side after it is
created, so `_positionMenu()` writes two of its private fields:

| Field | Meaning | Why it is set |
| --- | --- | --- |
| `_userArrowSide` | The preferred side, which GNOME flips away from when the box does not fit | Makes the panel prefer the right of the pointer |
| `_arrowSide` | The side in use right now, which also sets the direction of the opening animation | Avoids one layout pass with the old side and makes the panel slide in from the correct direction |

Both exist under these names in the GNOME Shell versions the extension
supports. As private API, they could be renamed in a future GNOME release; if
the panel opens in the wrong place after a GNOME upgrade, check them first in
`js/ui/boxpointer.js` of GNOME Shell.

The menu's `_boxPointer` itself is also a private field of `PopupMenu`.

## Testing

1. With the setting **off** (default), open the panel by clicking its icon
   and with the shortcut: it drops down below the icon, as before.
2. Switch the setting **on** in the preferences. With the pointer in the
   middle of the screen, open the panel with the shortcut: it opens to the
   right of the pointer with its bottom edge level with it.
3. With the pointer near the right edge of the screen: it opens to the left
   of the pointer.
4. With the pointer near the top edge: the panel stays fully on screen.
5. With two monitors, open it on each: it opens on the pointer's monitor.
6. Switch the setting off again without logging out: the next time, it opens
   below the icon.
7. Disable and enable the extension, and lock and unlock the screen. Watch
   `journalctl -f -o cat /usr/bin/gnome-shell` meanwhile: no errors.
