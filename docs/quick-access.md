# 1Password Quick Access

With **1Password Quick Access** on (Preferences → Cursor-Follow), pressing the
clipboard shortcut again while the panel is open closes the panel and opens
1Password Quick Access, placed like the panel: its bottom-left corner at the
pointer. Off by default; it can only be switched
on while 1Password is installed and running.

Only one of the two can be open at a time: GNOME closes a panel menu as soon
as another window takes the keyboard, and Quick Access hides as soon as it
loses it. So the panel comes first, and the second press switches.

Everything else stays as it was: clicking the panel icon, and the shortcut
while the setting is off or the panel is closed, toggle the panel as before.

The code is in `feature/quickAccess.js` and `feature/onePassword.js`; each
section starts with a tag:

```bash
grep -rn "\[quick-access:" feature/
```

<a id="quick-access-setting"></a>
## `quick-access:setting`

Boolean key `quick-access` in `feature/settings-keys.xml`, default `false`.
The installer does not switch it on.

<a id="quick-access-detection"></a>
## `quick-access:detection`

`feature/onePassword.js`, shared by the extension and its preferences. 1Password
counts as installed when `1password` is on the `PATH`, at
`/opt/1Password/1password`, or installed as the Flatpak
`com.onepassword.OnePassword`; the matching command is run with
`--quick-access`, the way 1Password documents for Wayland. It counts as
running when `pgrep -x 1password` finds a process: Quick Access only opens
while the app runs, usually in the background. Without `pgrep` this cannot be
checked, and the feature stays unavailable.

<a id="quick-access-preference"></a>
## `quick-access:preference`

The **1Password Quick Access** switch in the Cursor-Follow group. It checks
availability when the preferences open: if 1Password is missing or not
running, the switch cannot be turned on, its subtitle says why, and **Check
again** looks once more. It can always be turned off.

<a id="quick-access-entry-point"></a>
## `quick-access:entry-point`

`feature/extension.js` creates the `QuickAccessSwitch` after the original has
built its panel, and destroys it first on `disable()`.

<a id="quick-access-shortcut"></a>
## `quick-access:shortcut`, `quick-access:shortcut-action`

The original registers its shortcut as the keybinding `toggle-shortcut`.
`QuickAccessSwitch` removes it and registers it again, with the same setting,
flags and action modes (normal, overview, and while a menu is open), but its
own handler. `shortcutAction()` decides: with the setting on and the panel
open, switch to Quick Access; otherwise toggle the panel, exactly like the
original. The handler is in place whether the setting is on or off, so
switching the setting needs nothing else.

This depends on the original's keybinding name; `build.sh` warns if a release
no longer has `toggle-shortcut`.

<a id="quick-access-switch"></a>
## `quick-access:switch`

Notes where the pointer is, closes the panel, and checks again that
1Password is installed and running; if not, a notification says why. Then it
starts waiting for a 1Password window and runs the Quick Access command.

The first 1Password window shown within 15 seconds is moved into place. Each
new window is checked when it is shown, not when it is created: at creation
it has no class or app ID yet. For 1.5 seconds after that, if 1Password moves or resizes
the window itself, it is put back; after that you can move it freely. Quick Access can take a few seconds to appear, and 1Password's own
forums report that on some systems it only appears on the second call; this
code does not work around either.

<a id="quick-access-window-match"></a>
## `quick-access:window-match`

`isOnePasswordWindow()` recognises 1Password by its window class or app ID:
`1Password` when it runs through XWayland, `com.onepassword.OnePassword` when
it runs natively on Wayland or as the Flatpak.

<a id="quick-access-placement"></a>
## `quick-access:placement`

`placeQuickAccess()` places Quick Access the way the panel is placed: its
bottom-left corner at the pointer, so it extends up and to the right. When
there is not enough room on the right, it goes to the left of the pointer
instead, with its bottom-right corner at the pointer. It is then moved only
as far as needed to stay inside the monitor's work area, for example when the
pointer is near the top of the screen.

<a id="quick-access-cleanup"></a>
## `quick-access:cleanup`

On `disable()`: cancels a running availability check and stops waiting for a
window. The shortcut itself is removed by the original's `disable()`, which
runs next.

## Testing

`tests/js/quickAccess.test.mjs` covers the shortcut decision, the placement
and the availability checks. Whether Quick Access really opens at the
pointer can only be checked by hand, on a GNOME desktop with 1Password:

1. Setting off: the shortcut toggles the panel as before.
2. 1Password not running: the switch cannot be turned on and says why; start
   1Password, **Check again**, and it can.
3. Setting on, panel open, pointer mid-screen: the shortcut closes the panel
   and Quick Access appears with its bottom-left corner at the pointer.
4. Pointer near the right edge: Quick Access appears to the left of the
   pointer. Near the top: it stays on screen.
5. Quit 1Password with the setting on: the second press shows a notification
   instead of Quick Access.
