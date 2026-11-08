# 1Password Quick Access

An optional integration with [1Password](https://1password.com/), a
third-party password manager by AgileBits. It is **not installed by default**:
see [installing it](#quick-access-install). Once installed, and with
**1Password Quick Access** switched on (Preferences → Cursor-Follow), pressing
the clipboard shortcut again while the panel is open closes the panel and
opens 1Password Quick Access, placed like the panel: its bottom-left corner
at the pointer. The switch is off by default and can only be turned on while
1Password is installed and running.

A thank-you to 1Password for offering a native Linux app, with a
documented command for opening Quick Access on Wayland: that is what makes
this integration possible. This project is not affiliated with or endorsed
by 1Password.

**1Password links:**
[1Password](https://1password.com/) ·
[Install 1Password on Linux](https://support.1password.com/install-linux/) ·
[Keyboard shortcuts on Linux, including Wayland](https://support.1password.com/keyboard-shortcuts/?linux)

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

<a id="quick-access-install"></a>
## `quick-access:install`

```bash
./install.sh --with-1password      # include the integration
./install.sh --without-1password   # leave it out again (the default)
```

Without `--with-1password`, `install.sh` leaves `quickAccess.js`,
`onePassword.js` and `roundedCorners.js` out of the installed copy and writes
`FEATURES = {quickAccess: false}` into its `features.js`, so no 1Password
code is installed at all: no shortcut takeover, no switch in the
preferences, no 1Password rows in About. The choice is kept by later installs
and updates until changed with the other flag; removing the integration also
switches its setting off. `./verify.sh` shows whether it is installed.

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
`--quick-access`, the way 1Password
[documents for Wayland](https://support.1password.com/keyboard-shortcuts/?linux). It counts as
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

When `features.js` says the integration is installed, `feature/extension.js`
loads `quickAccess.js` after the original has built its panel and creates the
`QuickAccessSwitch`; it is destroyed first on `disable()`. The module is
loaded with a dynamic `import()`, so the extension also works when the file
is not installed. The preferences load `onePassword.js` the same way.

<a id="quick-access-about"></a>
## `quick-access:about`

With the integration installed, the About group in the preferences also links
to 1Password and to its Linux installation page, and says that this project
is not affiliated with 1Password.

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

<a id="quick-access-rounded-corners"></a>
## `quick-access:rounded-corners`

`feature/roundedCorners.js`. With **Round Quick Access corners** on (the
default; Preferences → Cursor-Follow, below the Quick Access switch), the
Quick Access window gets rounded corners with GNOME's usual 12 px radius.

1Password is not changed or asked for anything: GNOME Shell draws every
window itself, and a small shader effect on the Quick Access window, as GNOME
Shell draws it, makes the pixels outside the rounded corners transparent.
`cornerBounds()` finds the window's visible frame inside what GNOME Shell
draws, which can include invisible borders, so only the frame's four corners
are cut. The effect follows size changes and is removed when the window
closes or the extension is disabled.

GNOME Shell 51 removed the shader API older versions used (`Shell.GLSLEffect`)
in favour of `Clutter.ShaderEffect` with a shader snippet. `shaderApi()`
picks whichever the running GNOME Shell has, recognising GNOME 51's by the
`set_uniform_float()` method it added (looking up the snippet function itself
on GNOME's class throws, because only subclasses implement it); the effect class is only created
on first use, so a GNOME Shell with neither cannot stop the rest of the
1Password integration from loading. In that case, or if the effect cannot be
added, the window simply keeps square corners and a warning is logged.

The switch only applies while Quick Access is switched on, and takes effect
the next time Quick Access opens.

<a id="quick-access-cleanup"></a>
## `quick-access:cleanup`

On `disable()`: cancels a running availability check, stops waiting for a
window, and removes the rounded corners. The shortcut itself is removed by the original's `disable()`, which
runs next.

## Testing

`tests/js/quickAccess.test.mjs` covers the shortcut decision, the placement
and the availability checks; `tests/js/roundedCorners.test.mjs` the corner
bounds and adding, updating and removing the effect. Whether Quick Access really opens at the
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
6. With **Round Quick Access corners** on, Quick Access has rounded corners;
   switched off, square ones (from the next time it opens).
