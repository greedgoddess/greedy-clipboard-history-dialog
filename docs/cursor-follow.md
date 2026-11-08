# Open at mouse pointer: how it works

This project contains none of the original extension's code. `build.sh`
downloads a release of Clipboard History and adds this project's files to it.
The original code stays unchanged; this project's files extend it.

Each section of this project's code starts with a comment holding a tag, for
example `[cursor-follow:positioning]`, and a link to its chapter here:

```bash
grep -rn "\[cursor-follow:" feature/
```

| Tag | File |
| --- | --- |
| [`cursor-follow:entry-point`](#cursor-follow-entry-point) | `feature/extension.js` |
| [`cursor-follow:find-menu`](#cursor-follow-find-menu) | `feature/extension.js` |
| [`cursor-follow:install`](#cursor-follow-install) | `feature/cursorFollow.js` |
| [`cursor-follow:arrow-alignment`](#cursor-follow-arrow-alignment) | `feature/cursorFollow.js` |
| [`cursor-follow:positioning`](#cursor-follow-positioning) | `feature/cursorFollow.js` |
| [`cursor-follow:cleanup`](#cursor-follow-cleanup) | `feature/cursorFollow.js` |
| [`cursor-follow:preference`](#cursor-follow-preference) | `feature/prefs.js` |
| [`cursor-follow:setting`](#cursor-follow-setting) | `feature/settings-keys.xml` |
| [`about:attribution`](#about-attribution) | `feature/prefs.js` |

<a id="how-the-build-works"></a>
## How the build works

`build.sh` gets a release, hands it to `scripts/patch_release.py`, checks the
result and puts it in `build/`:

1. **Get the release.** By default, the newest release in
   `tested-releases.json` that supports the running GNOME Shell, downloaded
   from extensions.gnome.org and compared with the tested one by a hash of
   its files (without `metadata.json`, which the website regenerates).
   `--latest`, `--version N`, `--zip FILE` and `--from-git [REF]` choose
   another one; such a build is marked untested. The release is unpacked
   only if it contains nothing but ordinary files inside its own folder,
   within size limits.
2. **Keep the original entry points under new names.** `extension.js`
   becomes `upstream-extension.js` and `prefs.js` becomes `upstream-prefs.js`,
   both unchanged. This project's `extension.js` and `prefs.js` take their
   place and extend them.
3. **Give the build its own identity.** UUID
   `greedy-clipboard-history-dialog@greedgoddess`, its own settings schema
   and settings path, and its own name. The original takes its UUID and
   schema from `metadata.json`, so its code needs no change for this; any
   place that names them literally is rewritten and reported. Because the
   UUID differs, the build keeps its own settings and clipboard history,
   and extensions.gnome.org never offers to replace it.
4. **Add the settings** from `feature/settings-keys.xml` to the schema, key
   by key; a key the original already has is kept and reported. The schema
   is checked with an XML parser before (exactly one schema with the
   original's ID, no duplicated keys) and after the change (own ID and
   path, every original key kept, no duplicates); anything unexpected stops
   the build.
5. **Write `metadata.json`** with this identity, the original's version and
   the original's list of supported GNOME Shell versions. When a new release
   adds a GNOME Shell version, the next build supports it too. The version
   name combines this project's version with the original's release.
6. **Check** that the schema compiles, that the release supports the running
   GNOME Shell, and, in the running GNOME Shell's own code, that the
   internals described under [positioning](#cursor-follow-positioning)
   exist.

A build that fails any required step leaves `build/` as it was: the new build
is assembled next to it, in `.build.new/`, and swapped in by two directory
renames; a run interrupted between them is undone automatically. Each build
contains `build-info.json`, its provenance: this project's version and
feature commit, the original's URL, release and version, where the release
was downloaded, its content hash, whether it is tested, when and on which
GNOME Shell it was built, and any warnings. `build/BUILD-INFO` shows the
same for people. The previous build is kept in `build/previous/`, and the
release zip in `build/release.zip` for the tests.

A release enters `tested-releases.json` only through
`update-test-and-push.sh`, after the build has no warnings and
`tests/run-tests.sh` passes.

### What can break, and what happens then

| Change in a new release or GNOME Shell | Result |
| --- | --- |
| Anything inside the original that keeps its panel button | Nothing; the feature does not depend on it |
| `extension.js` no longer has `export default class` | Build stops; the installed copy keeps running |
| The release drops the running GNOME Shell version | Build stops (`--force` overrides) |
| The original no longer registers its button with `addToStatusArea()` or no longer uses a `PanelMenu` | Build warns; the panel opens below its icon |
| GNOME Shell renames `_boxPointer`, `_userArrowSide` or `_arrowSide` | Build warns; the panel opens below its icon or in the wrong place |
| The original adds its own `cursor-follow` setting | Build warns and keeps the original's key |

In every case, the installed copy keeps running, `./build.sh` keeps building
the last tested release, and `build/previous/` holds the build before.

<a id="cursor-follow-entry-point"></a>
## `cursor-follow:entry-point`

`feature/extension.js` is the extension's entry point. Its class extends the
original's class from `upstream-extension.js`:

- `enable()` runs the original's `enable()`, then installs
  [`CursorFollow`](#cursor-follow-install) on the original's panel menu and
  starts the [`HoverPreview`](hover-preview.md), the
  [`PasswordManagerSwitch`](password-managers.md) and the
  [`UpdateNotifier`](update-notifications.md);
- `disable()` stops both first, then runs the original's `disable()`.

The original runs exactly as it would on its own; it is not aware of the
addition.

<a id="cursor-follow-find-menu"></a>
## `cursor-follow:find-menu`

GNOME Shell keeps panel buttons in `Main.panel.statusArea`, under the role
passed to `Main.panel.addToStatusArea()`. The original passes its UUID, which
in the build is this project's UUID, so `Main.panel.statusArea[this.uuid]` is
its button. If that ever fails, the original's own `_indicator` field is
tried. If neither has a menu, `CursorFollow` does nothing and a warning is
logged.

<a id="cursor-follow-install"></a>
## `cursor-follow:install`

The `CursorFollow` constructor, given the panel menu and the settings:

- does nothing if the menu has no `_boxPointer` with a `setPosition()`
  method; the panel then opens below its icon as usual;
- adds a 1×1, transparent, non-reactive `St.Widget` to `Main.uiGroup` as the
  pointer anchor, because `BoxPointer.setPosition()` points at an actor, not
  at coordinates;
- keeps a reference to the `BoxPointer`, saves its original `setPosition`
  and its arrow side (`St.Side.TOP` for a panel menu), then replaces
  `setPosition` on that one instance with a wrapper that calls
  [`_positionMenu()`](#cursor-follow-positioning) while active, and the
  original otherwise;
- follows the `BoxPointer`'s `destroy` signal, so that it never touches a
  destroyed object.

The hook is installed whether the setting is on or off, so switching the
setting needs no extra code.

<a id="cursor-follow-arrow-alignment"></a>
## `cursor-follow:arrow-alignment`

`POINTER_ARROW_ALIGNMENT = 1.0` places the arrow at the bottom of the panel's
left edge (`0.0` is the top). The pointer then touches the panel's
bottom-left corner, so the bottom edge is level with the pointer, within the
few pixels the arrow keeps clear of the rounded corner.

<a id="cursor-follow-positioning"></a>
## `cursor-follow:positioning`

`PopupMenu.open()` calls `BoxPointer.setPosition(sourceActor, alignment)`
each time the menu opens; with the hook in place, `_positionMenu()` runs
instead.

- **Setting off:** restores the saved arrow side and calls the original with
  the original arguments. Same result as without this project.
- **Setting on:** moves the anchor to `global.get_pointer()`, sets the arrow
  side to `St.Side.LEFT`, and calls the original with the anchor and
  `POINTER_ARROW_ALIGNMENT`. An arrow on the left edge puts the panel to the
  right of the pointer. When that does not fit, `BoxPointer` flips it to the
  left by itself, and keeps it on the anchor's monitor.

The original `setPosition()` is called rather than reimplemented, so GNOME
keeps tracking the source actor as it normally does.

**GNOME Shell internals used.** `BoxPointer` has no public setter for the
arrow side, so two private fields are written: `_userArrowSide`, the
preferred side, which GNOME flips away from when space runs out, and
`_arrowSide`, the side in use, which also sets the direction of the opening
animation. The menu's `_boxPointer` is itself private. `build.sh` looks for
all three in the running GNOME Shell's `boxpointer.js` and `popupMenu.js`.

<a id="cursor-follow-cleanup"></a>
## `cursor-follow:cleanup`

`CursorFollow.destroy()`, called from `disable()` before the original's
`disable()`, which also runs on every screen lock:

- stops pointer placement;
- puts the original `setPosition` back, but only if the wrapper is still the
  one in place. If another extension has wrapped it since, their wrapper is
  left alone, and ours passes every call straight on to the original;
- restores the arrow side and destroys the anchor.

Each step only runs if its install step did, and nothing is done to a
`BoxPointer` that GNOME has already destroyed.

<a id="cursor-follow-preference"></a>
## `cursor-follow:preference`

`feature/prefs.js` extends the original preferences from `upstream-prefs.js`.
After the original has filled the window (synchronously or asynchronously),
it adds a **Cursor-Follow** group to the page the original shows first (or
to a page of its own if there is none), with two switches:
**Open at mouse pointer**, bound to `cursor-follow`, and
[**Update notifications**](update-notifications.md#update-notify-preference). If a release has no usable
preferences of its own, the build supplies an empty base, so only the
Cursor-Follow switches are shown.

<a id="cursor-follow-setting"></a>
## `cursor-follow:setting`

Boolean key `cursor-follow`, default `false`, in `feature/settings-keys.xml`,
inserted into the original's settings schema by the build. It is read each time the panel opens, so it
needs no change handler. `install.sh` switches it on at the first install.

<a id="about-attribution"></a>
## `about:attribution`

An **About** group in the preferences, under Cursor-Follow: Clipboard History
and its author, with links to its repository and its extensions.gnome.org
page, and this project with a link to its repository. It shows the installed
versions from `build-info.json`, the license, and that this project is not
affiliated with the original author.

<a id="testing"></a>
## Testing

`tests/run-tests.sh` covers three levels:

| Level | What | How |
| --- | --- | --- |
| Structural | The original is unchanged; identity, schema and provenance are right; the GNOME Shell internals exist | Build checks; `build.sh` looks in the running GNOME Shell |
| Runtime | The extension loads without errors and hooks into the panel menu | Headless GNOME Shell smoke test |
| Behavioural | The panel really opens at the pointer and flips | By hand, below |

The patcher, the build swap, the installer, migration and uninstall, and the
hook also have unit tests, with made-up releases and stand-ins for GNOME.
The migration and uninstall tests check in particular that the original
extension's files, history and settings are never touched.

**The smoke test needs GNOME.** It starts GNOME Shell without a window, which
works on a GNOME desktop. On headless systems (servers, CI containers)
GNOME Shell may not start, and the smoke test then fails. It says so in its
output, with exit status 2 instead of 1, and shows GNOME Shell's log. A
release is recorded as tested only when the smoke test passes. CI does not
run it: a CI container has no GNOME session, and the project does not test
against stand-ins for the missing services.

**By hand,** before marking a GNOME Shell version as verified in the README:

1. Setting off: the panel opens below its icon, by click and by shortcut.
2. Setting on, pointer mid-screen: the panel opens right of the pointer,
   bottom edge level with it.
3. Pointer near the right edge: it opens left of the pointer.
4. Pointer near the left and top edges: it stays on screen.
5. Two monitors, if available: it opens on the pointer's monitor.
6. Switch the setting off without logging out: the next open is below the
   icon again.
7. Lock and unlock the screen, and disable and enable the extension, while
   watching `journalctl -f -o cat /usr/bin/gnome-shell`: no errors.
