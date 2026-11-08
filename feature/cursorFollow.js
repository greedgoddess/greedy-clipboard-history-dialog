/* cursorFollow.js — "Open at mouse pointer" for Clipboard History
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Opens the extension's panel menu next to the mouse pointer instead of
 * below its panel icon, when the 'cursor-follow' setting is on. GNOME's own
 * BoxPointer still does all measuring, flipping and animation; this only
 * changes what it points at and from which side.
 * Explained section by section in docs/cursor-follow.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// [cursor-follow:arrow-alignment]
// Where the popup's arrow sits along its left edge: 0.0 is the top, 1.0 the
// bottom. At 1.0 the popup's bottom edge is level with the pointer.
// See docs/cursor-follow.md#cursor-follow-arrow-alignment
const POINTER_ARROW_ALIGNMENT = 1.0;

export class CursorFollow {
    /** [cursor-follow:install]
     * Hooks into the given PopupMenu's BoxPointer. Does nothing if the menu
     * has no usable BoxPointer, so that a change in GNOME Shell or in the
     * original extension leaves the menu at its normal position.
     * See docs/cursor-follow.md#cursor-follow-install */
    constructor(menu, settings) {
        this._settings = settings;
        this._active = false;

        const boxPointer = menu?._boxPointer;
        if (typeof boxPointer?.setPosition !== 'function')
            return;

        // A 1×1 transparent actor, moved to the pointer each time the menu
        // opens; the BoxPointer points at it instead of the panel icon.
        this._pointerAnchor = new St.Widget({
            width: 1,
            height: 1,
            opacity: 0,
            reactive: false,
            can_focus: false,
        });
        Main.uiGroup.add_child(this._pointerAnchor);

        this._boxPointer = boxPointer;
        this._panelArrowSide = boxPointer._userArrowSide;

        // The wrapper keeps working even after destroy(): if another extension
        // wrapped it in the meantime, it stays in their chain and simply passes
        // every call on to the original.
        const originalSetPosition = boxPointer.setPosition;
        this._originalSetPosition = originalSetPosition;
        this._wrapper = (sourceActor, alignment) => this._active
            ? this._positionMenu(sourceActor, alignment)
            : originalSetPosition.call(boxPointer, sourceActor, alignment);
        boxPointer.setPosition = this._wrapper;
        this._active = true;

        // If GNOME destroys the BoxPointer first, forget it instead of
        // touching a destroyed object later.
        this._boxPointerDestroyId = boxPointer.connect('destroy', () => {
            this._active = false;
            this._boxPointer = null;
            this._boxPointerDestroyId = 0;
        });
    }

    /** True when the hook is in place. */
    get active() {
        return this._active;
    }

    /** [cursor-follow:positioning]
     * Replacement for BoxPointer.setPosition(), called by PopupMenu.open().
     * Setting off: behaves exactly like the original. Setting on: points the
     * original at the anchor, moved to the pointer, with the arrow on the
     * popup's left edge, which places the popup to the right of the pointer.
     * See docs/cursor-follow.md#cursor-follow-positioning */
    _positionMenu(sourceActor, alignment) {
        const boxPointer = this._boxPointer;

        if (!this._settings.get_boolean('cursor-follow')) {
            boxPointer._userArrowSide = this._panelArrowSide;
            boxPointer._arrowSide = this._panelArrowSide;
            this._originalSetPosition.call(boxPointer, sourceActor, alignment);
            return;
        }

        const [pointerX, pointerY] = global.get_pointer();
        this._pointerAnchor.set_position(pointerX, pointerY);

        // Private BoxPointer fields, no public setter: _userArrowSide is the
        // preferred side (GNOME flips away from it when space runs out),
        // _arrowSide the side in use (also the opening animation direction).
        boxPointer._userArrowSide = St.Side.LEFT;
        boxPointer._arrowSide = St.Side.LEFT;
        this._originalSetPosition.call(boxPointer, this._pointerAnchor, POINTER_ARROW_ALIGNMENT);
    }

    /** [cursor-follow:cleanup]
     * Stops pointer placement, restores the original method if nothing else
     * replaced it since, restores the arrow side and removes the anchor.
     * See docs/cursor-follow.md#cursor-follow-cleanup */
    destroy() {
        this._active = false;
        const boxPointer = this._boxPointer;
        if (boxPointer) {
            boxPointer.disconnect(this._boxPointerDestroyId);
            if (boxPointer.setPosition === this._wrapper)
                boxPointer.setPosition = this._originalSetPosition;
            boxPointer._userArrowSide = this._panelArrowSide;
            boxPointer._arrowSide = this._panelArrowSide;
            this._boxPointer = null;
        }
        if (this._pointerAnchor) {
            this._pointerAnchor.destroy();
            this._pointerAnchor = null;
        }
        this._settings = null;
    }
}
