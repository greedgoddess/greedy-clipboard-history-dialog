/* quickAccess.js — switch from the clipboard panel to 1Password Quick Access
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * GNOME closes a panel menu as soon as another window takes the keyboard, and
 * Quick Access hides as soon as it loses it, so the two cannot be open at
 * the same time. With the 'quick-access' setting on, pressing the clipboard
 * shortcut while the panel is open closes the panel and opens Quick Access
 * where the panel was, against the same corner. Explained
 * section by section in docs/quick-access.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {quickAccessAvailability} from './onePassword.js';
import {CornerRounder} from './roundedCorners.js';

// The original extension's keybinding, in its settings schema.
const SHORTCUT_KEY = 'toggle-shortcut';
// Quick Access can take several seconds to appear; give up waiting after this.
const WINDOW_WAIT_SECONDS = 15;
// If 1Password moves its window itself right after showing it, put it back
// during this long.
const KEEP_IN_PLACE_MS = 1500;

/** [quick-access:shortcut-action]
 * What the shortcut does: 'switch' to Quick Access when the setting is on
 * and the panel is open; otherwise 'toggle' the panel, as the original does.
 * See docs/quick-access.md#quick-access-shortcut */
export function shortcutAction(quickAccessOn, panelOpen) {
    return quickAccessOn && panelOpen ? 'switch' : 'toggle';
}

/** [quick-access:anchor]
 * The corner Quick Access is placed against: the visible panel's bottom-left
 * corner when the panel is to the right of the pointer, its bottom-right
 * corner when it was flipped to the left. Without a panel, the pointer.
 * A GNOME panel menu is an invisible outer box around the visible one, which
 * is why the visible panel, not the pointer, is used: then Quick Access sits
 * exactly where the panel was, at the same distance from the pointer.
 * pointer is {x, y}; panel is the visible box {x, y, width, height} or null.
 * See docs/quick-access.md#quick-access-placement */
export function quickAccessAnchor(pointer, panel) {
    if (!panel)
        return {x: pointer.x, y: pointer.y, side: 'right', fromPanel: false};
    const leftOfPointer = panel.x + panel.width <= pointer.x;
    return leftOfPointer
        ? {x: panel.x + panel.width, y: panel.y + panel.height, side: 'left', fromPanel: true}
        : {x: panel.x, y: panel.y + panel.height, side: 'right', fromPanel: true};
}

/** [quick-access:placement]
 * Where Quick Access goes: its bottom-left corner on the anchor (side
 * 'right'), or its bottom-right corner (side 'left'). Anchored at the
 * pointer, it goes to the left instead when there is no room on the right,
 * like the panel; anchored at the panel, it stays against the panel. Either
 * way it is then moved only as far as needed to stay inside the monitor's
 * work area. window and workArea are {x, y, width, height}.
 * See docs/quick-access.md#quick-access-placement */
export function placeQuickAccess(anchor, window, workArea) {
    const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
    const right = workArea.x + workArea.width;
    let x = anchor.side === 'left' ? anchor.x - window.width : anchor.x;
    if (!anchor.fromPanel && anchor.side !== 'left' && x + window.width > right)
        x = anchor.x - window.width;
    return {
        x: clamp(x, workArea.x, right - window.width),
        y: clamp(anchor.y - window.height, workArea.y, workArea.y + workArea.height - window.height),
    };
}

/** [quick-access:window-match]
 * True for a window of the 1Password app. Its class is "1Password" when it
 * runs through XWayland, and its app ID "com.onepassword.OnePassword" when it
 * runs natively on Wayland or as the Flatpak.
 * See docs/quick-access.md#quick-access-window-match */
export function isOnePasswordWindow(wmClass) {
    return /1password|onepassword/i.test(wmClass ?? '');
}

export class QuickAccessSwitch {
    /** [quick-access:shortcut]
     * Takes over the original's shortcut with the same settings and action
     * modes, so that its handler can decide between toggling the panel and
     * switching to Quick Access.
     * See docs/quick-access.md#quick-access-shortcut */
    constructor(menu, settings) {
        this._menu = menu;
        this._settings = settings;
        this._cancellable = new Gio.Cancellable();
        this._windowCreatedId = 0;
        this._waitTimeoutId = 0;
        this._cornerRounder = new CornerRounder();
        this.active = false;
        if (!menu)
            return;

        Main.wm.removeKeybinding(SHORTCUT_KEY);
        Main.wm.addKeybinding(SHORTCUT_KEY, settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            () => this._onShortcut());
        this.active = true;
    }

    /** Opens Quick Access where the panel is, as the second press of the shortcut
     * does; used by the 1Password button in large spacing. */
    openQuickAccess() {
        this._switchToQuickAccess().catch(error => console.warn(`Quick Access: ${error.message}`));
    }

    _onShortcut() {
        if (shortcutAction(this._settings.get_boolean('quick-access'), this._menu.isOpen) === 'switch')
            this._switchToQuickAccess().catch(error => console.warn(`Quick Access: ${error.message}`));
        else
            this._menu.toggle();
    }

    /** [quick-access:switch]
     * Notes where the pointer and the visible panel are, closes the panel, checks that 1Password is
     * installed and running, then opens Quick Access and waits for its window.
     * See docs/quick-access.md#quick-access-switch */
    async _switchToQuickAccess() {
        const [x, y] = global.get_pointer();
        let panel = null;
        if (this._menu.isOpen) {
            const [px, py] = this._menu.box.get_transformed_position();
            const [width, height] = this._menu.box.get_transformed_size();
            panel = {x: px, y: py, width, height};
        }
        const anchor = quickAccessAnchor({x, y}, panel);
        this._menu.close();

        const availability = await quickAccessAvailability(this._cancellable);
        if (this._cancellable.is_cancelled())
            return;
        if (!availability.available) {
            Main.notify('1Password Quick Access is not available', availability.reason);
            return;
        }
        this._placeNextWindow(anchor);
        Gio.Subprocess.new(availability.command, Gio.SubprocessFlags.NONE);
    }

    /** Moves the next 1Password window that appears to its place at the
     * anchor, and keeps it there briefly in case 1Password moves it itself.
     * A window has no class yet when it is created, so each new window is
     * checked when it is shown. */
    _placeNextWindow(anchor) {
        this._stopWaiting();
        this._windowCreatedId = global.display.connect('window-created', (_display, window) => {
            const shownId = window.connect('shown', () => {
                window.disconnect(shownId);
                if (!this._windowCreatedId || !isOnePasswordWindow(window.get_wm_class()))
                    return;
                this._stopWaiting();
                this._keepInPlace(window, anchor);
                // Rounded corners are part of Large spacing.
                if (this._settings.get_boolean('large-spacing')) {
                    try {
                        if (!this._cornerRounder.round(window))
                            console.warn('Quick Access: this GNOME Shell has no shader API for rounded corners');
                    } catch (error) {
                        console.warn(`Quick Access: corners not rounded: ${error.message}`);
                    }
                }
            });
        });
        this._waitTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, WINDOW_WAIT_SECONDS, () => {
            this._waitTimeoutId = 0;
            this._stopWaiting();
            return GLib.SOURCE_REMOVE;
        });
    }

    _keepInPlace(window, anchor) {
        const target = () => {
            const frame = window.get_frame_rect();
            const monitor = window.get_monitor();
            const workArea = Main.layoutManager.getWorkAreaForMonitor(
                monitor >= 0 ? monitor : global.display.get_current_monitor());
            return placeQuickAccess(anchor, frame, workArea);
        };
        const move = () => {
            const {x, y} = target();
            const frame = window.get_frame_rect();
            if (frame.x !== x || frame.y !== y)
                window.move_frame(true, x, y);
        };
        move();
        // Moves by 1Password itself, and size changes, are corrected for a
        // short while; after that, the user may move the window freely.
        const ids = ['position-changed', 'size-changed'].map(signal => window.connect(signal, move));
        const unmanagedId = window.connect('unmanaged', () => stop());
        let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, KEEP_IN_PLACE_MS, () => {
            timeoutId = 0;
            stop();
            return GLib.SOURCE_REMOVE;
        });
        let stopped = false;
        const stop = () => {
            if (stopped)
                return;
            stopped = true;
            ids.forEach(id => window.disconnect(id));
            window.disconnect(unmanagedId);
            if (timeoutId)
                GLib.source_remove(timeoutId);
            timeoutId = 0;
            this._stopKeeping = null;
        };
        this._stopKeeping = stop;
    }

    _stopWaiting() {
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = 0;
        }
        if (this._waitTimeoutId) {
            GLib.source_remove(this._waitTimeoutId);
            this._waitTimeoutId = 0;
        }
    }

    /** [quick-access:cleanup]
     * Stops waiting for a window and cancels a running check. The shortcut
     * itself is removed by the original's disable(), which runs next.
     * See docs/quick-access.md#quick-access-cleanup */
    destroy() {
        this._cancellable.cancel();
        this._stopWaiting();
        this._stopKeeping?.();
        this._cornerRounder.destroy();
        this._menu = null;
        this._settings = null;
    }
}
