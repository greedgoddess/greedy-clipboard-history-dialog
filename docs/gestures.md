# Gestures

Optional, **not installed by default** (`./install.sh --with-gestures`;
`--without-gestures` removes them again). Two more ways to open the panel,
each with its own switch in Preferences → **Keyboard Shortcut and Gestures**, both off until
switched on:

- **Three-finger tap on the touchscreen:** opens the panel at the center of
  the three fingers. There is no pointer to follow on a touchscreen, so the
  center of the touches is the anchor, used the same way as the pointer in
  [Open at mouse pointer](cursor-follow.md#cursor-follow-open-at).
- **Three-finger hold on the touchpad:** rest three fingers for a moment,
  then lift them; the panel opens at the pointer. (A three-finger *tap* on a
  touchpad reaches GNOME only as a middle click, which cannot be told apart
  from a real one; a hold is a gesture GNOME does receive.)

Either one closes the panel again if it is already open.

The tap does nothing while an app on the **blocklist** is in focus: drawing
and note apps, and anything else where three fingers are part of the work.
The list starts with Krita, GIMP, Inkscape, Xournal++, Rnote and Drawing, and
can be changed in the preferences, by picking an installed app or typing an
app ID or window class.

One limit: GNOME only knows a tap was a tap once the fingers lift, so the app
underneath has already received the three touches. That is usually harmless,
and the blocklist is for the apps where it is not.

The code is `feature/gestures.js`; each section starts with a tag:

```bash
grep -rn "\[gestures:" feature/
```

<a id="gestures-settings"></a>
<a id="gestures-preference"></a>
<a id="gestures-shortcut-group"></a>
## `gestures:settings`, `gestures:preference`

Keys in `feature/settings-keys.xml`: `gesture-touchscreen-tap` and
`gesture-touchpad-hold` (both `false` by default) and `gesture-blocklist`
(app IDs or window classes). In the preferences, the gestures join the
original's **Keyboard Shortcut** group, which keeps its place and is called
**Keyboard Shortcut and Gestures** while the gestures are installed: a switch
for each trigger, and the blocklist, with a picker of installed apps and a
field for any ID. If a release of the original no longer has that group, the
gestures get a group of their own (`gestures:shortcut-group`). Removing the gestures with
`--without-gestures` also switches both triggers off.

<a id="gestures-install"></a>
<a id="gestures-entry-point"></a>
## `gestures:install`, `gestures:entry-point`, `gestures:cleanup`
<a id="gestures-cleanup"></a>

When `features.js` says the gestures are installed, `feature/extension.js`
loads `gestures.js` after the panel exists. It adds one watcher to GNOME
Shell's stage in the capture phase, the way GNOME's own touch swipes see
touches on top of windows. The watcher only looks: it never takes events
away from the apps. On `disable()` it is removed again. If a GNOME Shell does
not offer this, the gestures stay inactive and a warning is logged.

<a id="gestures-tap"></a>
## `gestures:tap`

`TapDetector` recognises the tap from the touch events: exactly three fingers,
landing within 150 ms of each other, all lifted within 400 ms of the first,
none moving more than 20 px; a cancelled touch spoils it. The anchor is the
average of the three landing points. It is plain logic without GNOME, so the
unit tests feed it touches directly.

<a id="gestures-hold"></a>
## `gestures:hold`

`holdCounts()`: a touchpad hold counts when it began with three fingers,
lasted at least 300 ms, and ended normally. When the fingers start moving,
GNOME cancels the hold (it becomes a swipe), so swipes never open the panel.

<a id="gestures-blocklist"></a>
## `gestures:blocklist`

`isBlocked()` compares the blocklist with the focused window's app ID (with or
without `.desktop`), window class and sandboxed app ID, without regard to
case. Applies to the tap; the touchpad hold is not affected.

## Testing

`tests/js/gestures.test.mjs` covers the tap (finger count, timing, movement,
cancelling, the center), the hold, and the blocklist.

By hand, on a device with a touchscreen and a touchpad:

1. Not installed: no gesture switches under Keyboard Shortcut; three fingers do what they did before.
2. Installed, switches off: nothing changes.
3. Tap switched on: a three-finger tap opens the panel at the center of the
   fingers; again, it closes it. A three-finger swipe still switches
   workspaces and does not open the panel.
4. With Krita (or another app on the list) in focus: the tap does nothing.
   Add an app with the picker, remove one with its trash button: it takes
   effect at once.
5. Hold switched on: resting three fingers on the touchpad and lifting them
   opens the panel at the pointer; a three-finger swipe does not.
