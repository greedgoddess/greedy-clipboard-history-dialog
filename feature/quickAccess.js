/* quickAccess.js — switch from the clipboard panel to 1Password Quick Access
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * GNOME closes a panel menu as soon as another window takes the keyboard, and
 * Quick Access hides as soon as it loses it, so the two cannot be open at
 * the same time. With the 'quick-access' setting on, pressing the clipboard
 * shortcut while the panel is open closes the panel and opens Quick Access
 * placed like the panel: its bottom-left corner at the pointer. Explained
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

/** [quick-access:placement]
 * Where Quick Access goes, placed like the clipboard panel: its bottom-left
 * corner at the pointer, so it extends up and to the right. When there is
 * not enough room on the right, it goes to the left of the pointer instead
 * (bottom-right corner at the pointer). It is then moved only as far as
 * needed to stay inside the monitor's work area.
 * pointer is {x, y}; window and workArea are {x, y, width, height}.
 * See docs/quick-access.md#quick-access-placement */
export function placeQuickAccess(pointer, window, workArea) {
    const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
    const right = workArea.x + workArea.width;
    const x = pointer.x + window.width <= right ? pointer.x : pointer.x - window.width;
    return {
        x: clamp(x, workArea.x, right - window.width),
        y: clamp(pointer.y - window.height, workArea.y, workArea.y + workArea.height - window.height),
    };
}

/** True for a window of the 1Password app. */
export function isOnePasswordWindow(wmClass) {
    return /1password/i.test(wmClass ?? '');
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
        this.active = false;
        if (!menu)
            return;

        Main.wm.removeKeybinding(SHORTCUT_KEY);
        Main.wm.addKeybinding(SHORTCUT_KEY, settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            () => this._onShortcut());
        this.active = true;
    }

    _onShortcut() {
        if (shortcutAction(this._settings.get_boolean('quick-access'), this._menu.isOpen) === 'switch')
            this._switchToQuickAccess().catch(error => console.warn(`Quick Access: ${error.message}`));
        else
            this._menu.toggle();
    }

    /** [quick-access:switch]
     * Notes where the pointer is, closes the panel, checks that 1Password is
     * installed and running, then opens Quick Access and waits for its window.
     * See docs/quick-access.md#quick-access-switch */
    async _switchToQuickAccess() {
        const [x, y] = global.get_pointer();
        this._menu.close();

        const availability = await quickAccessAvailability(this._cancellable);
        if (this._cancellable.is_cancelled())
            return;
        if (!availability.available) {
            Main.notify('1Password Quick Access is not available', availability.reason);
            return;
        }
        this._placeNextWindow({x, y});
        Gio.Subprocess.new(availability.command, Gio.SubprocessFlags.NONE);
    }

    /** Moves the next 1Password window that appears to its place at the
     * pointer, and keeps it there briefly in case 1Password moves it itself. */
    _placeNextWindow(pointer) {
        this._stopWaiting();
        this._windowCreatedId = global.display.connect('window-created', (_display, window) => {
            if (!isOnePasswordWindow(window.get_wm_class()))
                return;
            this._stopWaiting();
            const shownId = window.connect('shown', () => {
                window.disconnect(shownId);
                this._keepInPlace(window, pointer);
            });
        });
        this._waitTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, WINDOW_WAIT_SECONDS, () => {
            this._waitTimeoutId = 0;
            this._stopWaiting();
            return GLib.SOURCE_REMOVE;
        });
    }

    _keepInPlace(window, pointer) {
        const target = () => {
            const frame = window.get_frame_rect();
            const monitor = window.get_monitor();
            const workArea = Main.layoutManager.getWorkAreaForMonitor(
                monitor >= 0 ? monitor : global.display.get_current_monitor());
            return placeQuickAccess(pointer, frame, workArea);
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
        this._menu = null;
        this._settings = null;
    }
}
