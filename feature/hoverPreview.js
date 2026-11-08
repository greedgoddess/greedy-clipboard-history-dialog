/* hoverPreview.js — preview a clipboard entry while the pointer rests on it
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * With the 'hover-preview' setting on, resting the pointer on a text entry in
 * the history list shows up to 512 characters of it in an overlay with a
 * shadow, next to the panel. Works in the original layout and in Large
 * spacing. Explained section by section in docs/hover-preview.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const MAX_PREVIEW_CHARS = 512;
const SHOW_DELAY_MS = 350;      // How long the pointer rests before the preview shows
const GAP = 8;                  // Between the panel and the preview
const SCROLL_VIEW_CLASS = 'clipboard-history-scrollview';

/** [hover-preview:text]
 * The text shown: the entry's text, cut after 512 characters (counted as
 * characters, not bytes), with an ellipsis when it was cut.
 * See docs/hover-preview.md#hover-preview-text */
export function previewText(text) {
    const characters = [...text];
    return characters.length > MAX_PREVIEW_CHARS
        ? `${characters.slice(0, MAX_PREVIEW_CHARS).join('')}…`
        : text;
}

/** [hover-preview:placement]
 * Where the preview goes: next to the panel, on the right if it fits and on
 * the left otherwise, with its top level with the entry; moved only as far as
 * needed to stay inside the monitor's work area. All arguments are
 * rectangles {x, y, width, height} (size needs only width and height).
 * See docs/hover-preview.md#hover-preview-placement */
export function placePreview(item, panel, size, workArea) {
    const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
    const right = workArea.x + workArea.width;
    let x = panel.x + panel.width + GAP;
    if (x + size.width > right)
        x = panel.x - GAP - size.width;
    return {
        x: clamp(x, workArea.x, right - size.width),
        y: clamp(item.y, workArea.y, workArea.y + workArea.height - size.height),
    };
}

/** [hover-preview:find-entry]
 * The history entry an actor belongs to: the nearest ancestor with a text
 * entry (the original's history items carry their entry). Image entries and
 * everything else have no preview.
 * See docs/hover-preview.md#hover-preview-find-entry */
export function findTextEntry(actor) {
    for (let current = actor; current; current = current.get_parent?.() ?? null) {
        const entry = current.entry;
        if (entry && entry.type !== 'image' && typeof entry.text === 'string')
            return current;
    }
    return null;
}

function findByStyleClass(actor, styleClass) {
    if (actor.has_style_class_name?.(styleClass))
        return actor;
    for (const child of actor.get_children?.() ?? []) {
        const found = findByStyleClass(child, styleClass);
        if (found)
            return found;
    }
    return null;
}

export class HoverPreview {
    /** [hover-preview:install]
     * Watches the pointer over the history list (one handler on the list, so
     * entries the original re-creates are covered automatically).
     * See docs/hover-preview.md#hover-preview-install */
    constructor(menu, settings, stylesheet) {
        this._menu = menu;
        this._settings = settings;
        this._item = null;
        this._overlay = null;
        this._showTimeoutId = 0;
        this._scrollView = menu ? findByStyleClass(menu.box, SCROLL_VIEW_CLASS) : null;
        this.active = Boolean(this._scrollView);
        if (!this.active)
            return;

        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        this._stylesheet = stylesheet;
        this._theme.load_stylesheet(stylesheet);

        this._eventId = this._scrollView.connect('captured-event', (_actor, event) => this._onEvent(event));
        this._openId = menu.connect('open-state-changed', (_menu, open) => {
            if (!open)
                this._hide();
        });
        this._settingsId = settings.connect('changed::hover-preview', () => this._hide());
    }

    _onEvent(event) {
        const type = event.type();
        if (type === Clutter.EventType.MOTION && this._settings.get_boolean('hover-preview')) {
            const [x, y] = event.get_coords();
            const item = findTextEntry(global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y));
            if (item !== this._item) {
                this._hide();
                this._item = item;
                if (item) {
                    this._showTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SHOW_DELAY_MS, () => {
                        this._showTimeoutId = 0;
                        this._show(item);
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }
        } else if (type === Clutter.EventType.LEAVE || type === Clutter.EventType.SCROLL ||
                   type === Clutter.EventType.BUTTON_PRESS) {
            this._hide();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    /** [hover-preview:overlay]
     * The overlay: a label that wraps, in a box with a shadow (styles in
     * hoverPreview.css), above everything else, never taking the pointer.
     * See docs/hover-preview.md#hover-preview-overlay */
    _show(item) {
        if (!this._menu.isOpen || !item.get_stage())
            return;
        const label = new St.Label({text: previewText(item.entry.text)});
        label.clutter_text.line_wrap = true;
        label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._overlay = new St.Bin({style_class: 'greedy-hover-preview', child: label, reactive: false});
        Main.layoutManager.uiGroup.add_child(this._overlay);

        const [, width] = this._overlay.get_preferred_width(-1);
        const [, height] = this._overlay.get_preferred_height(width);
        const rect = actor => {
            const [x, y] = actor.get_transformed_position();
            const [w, h] = actor.get_transformed_size();
            return {x, y, width: w, height: h};
        };
        const monitor = Main.layoutManager.findIndexForActor(this._menu.box);
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor);
        const {x, y} = placePreview(rect(item), rect(this._menu.box), {width, height}, workArea);
        this._overlay.set_position(Math.round(x), Math.round(y));
    }

    _hide() {
        if (this._showTimeoutId) {
            GLib.source_remove(this._showTimeoutId);
            this._showTimeoutId = 0;
        }
        this._overlay?.destroy();
        this._overlay = null;
        this._item = null;
    }

    /** [hover-preview:cleanup]
     * See docs/hover-preview.md#hover-preview-cleanup */
    destroy() {
        if (!this.active)
            return;
        this._hide();
        this._scrollView.disconnect(this._eventId);
        this._menu.disconnect(this._openId);
        this._settings.disconnect(this._settingsId);
        this._theme.unload_stylesheet(this._stylesheet);
        this._menu = null;
        this._settings = null;
    }
}
