# Hover preview

With **Preview on hover** on (Preferences → Cursor-Follow; off by default),
resting the pointer on a text entry in the history list for a moment shows up
to 512 characters of it in an overlay with a shadow, next to the panel. It
works with the original layout and with [Large spacing](large-spacing.md). It
is always installed; only the switch turns it on.

The code is in `feature/hoverPreview.js` and `feature/hoverPreview.css`; each
section starts with a tag:

```bash
grep -rn "\[hover-preview:" feature/
```

<a id="hover-preview-setting"></a>
## `hover-preview:setting`, `hover-preview:preference`

Boolean key `hover-preview` in `feature/settings-keys.xml`, default `false`,
with the **Preview on hover** switch in the preferences. Switching it off
hides a preview that is showing.

<a id="hover-preview-entry-point"></a>
<a id="hover-preview-install"></a>
## `hover-preview:entry-point`, `hover-preview:install`

`feature/extension.js` creates `HoverPreview` after the original has built its
panel. It loads `hoverPreview.css` and watches the pointer over the history
list with one handler on the list itself, so entries the original re-creates
whenever the history changes are covered without anything more.

<a id="hover-preview-find-entry"></a>
## `hover-preview:find-entry`

When the pointer moves over the list, the actor under it is looked up, and
`findTextEntry()` goes up from there to the history entry it belongs to (the
original's entries carry their clipboard entry). Image entries, emoji and
everything else have no preview.

<a id="hover-preview-text"></a>
## `hover-preview:text`

`previewText()`: the entry's full text, not the shortened line in the list,
cut after 512 characters, with an ellipsis when it was cut. Characters are
counted as characters, so an emoji or an accented letter is never split.

<a id="hover-preview-overlay"></a>
## `hover-preview:overlay`, `hover-preview:style`

After the pointer has rested on the entry for 350 ms, a label that wraps
appears in a box with a shadow, at most 420 px wide, above everything else.
It never takes the pointer. It disappears when the pointer moves to another
entry or leaves the list, when the list scrolls or is clicked, and when the
panel closes. Its look is in `hoverPreview.css`.

<a id="hover-preview-placement"></a>
## `hover-preview:placement`

`placePreview()`: to the right of the panel if it fits, otherwise to the
left, with its top level with the entry, and moved only as far as needed to
stay inside the monitor's work area.

<a id="hover-preview-cleanup"></a>
## `hover-preview:cleanup`

On `disable()`: hides the preview, stops watching the list and unloads the
stylesheet.

## Testing

`tests/js/hoverPreview.test.mjs` covers the text (cut at 512 characters,
never splitting a character), the placement, and which entries have a
preview. The smoke test loads it switched on.

By hand:

1. Switch **Preview on hover** on. Rest the pointer on a long text entry: the
   preview appears next to the panel, with the full text up to 512
   characters.
2. Move to another entry: the preview follows. Leave the list, scroll, or
   click: it disappears.
3. Image entries and the Emoji, Kaomoji and Symbols tabs show no preview.
4. With the panel near the right edge of the screen, the preview appears on
   the panel's left.
5. Works the same with Large spacing on and off.
