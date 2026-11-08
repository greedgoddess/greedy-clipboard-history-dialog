/* quickAccess.js — switch from the clipboard panel to 1Password Quick Access
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * GNOME closes a panel menu as soon as another window takes the keyboard, and
 * Quick Access hides as soon as it loses it, so the two cannot be open at
 * the same time. With the 'quick-access' setting on, pressing the clipboard
 * shortcut while the panel is open closes the panel and opens Quick Access in
 * its place. Explained section by section in docs/quick-access.md.
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

/** [quick-access:shortcut-action]
 * What the shortcut does: 'switch' to Quick Access when the setting is on
 * and the panel is open; otherwise 'toggle' the panel, as the original does.
 * See docs/quick-access.md#quick-access-shortcut */
export function shortcutAction(quickAccessOn, panelOpen) {
    return quickAccessOn && panelOpen ? 'switch' : 'toggle';
}

/** [quick-access:placement]
 * Where Quick Access goes: in the panel's place, left edges aligned and
 * bottom edges level, moved only as far as needed to stay inside the
 * monitor's work area. All arguments are {x, y, width, height}.
 * See docs/quick-access.md#quick-access-placement */
export function placeQuickAccess(panel, window, workArea) {
    const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
    return {
        x: clamp(panel.x, workArea.x, workArea.x + workArea.width - window.width),
        y: clamp(panel.y + panel.height - window.height, workArea.y, workArea.y + workArea.height - window.height),
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
     * Notes where the panel is, closes it, checks that 1Password is installed
     * and running, then opens Quick Access and waits for its window.
     * See docs/quick-access.md#quick-access-switch */
    async _switchToQuickAccess() {
        const actor = this._menu.actor;
        const [x, y] = actor.get_transformed_position();
        const [width, height] = actor.get_transformed_size();
        this._menu.close();

        const availability = await quickAccessAvailability(this._cancellable);
        if (this._cancellable.is_cancelled())
            return;
        if (!availability.available) {
            Main.notify('1Password Quick Access is not available', availability.reason);
            return;
        }
        this._placeNextWindow({x, y, width, height});
        Gio.Subprocess.new(availability.command, Gio.SubprocessFlags.NONE);
    }

    /** Moves the next 1Password window that appears into the panel's place. */
    _placeNextWindow(panel) {
        this._stopWaiting();
        this._windowCreatedId = global.display.connect('window-created', (_display, window) => {
            if (!isOnePasswordWindow(window.get_wm_class()))
                return;
            this._stopWaiting();
            const shownId = window.connect('shown', () => {
                window.disconnect(shownId);
                const frame = window.get_frame_rect();
                const monitor = window.get_monitor();
                const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor >= 0 ? monitor : global.display.get_current_monitor());
                const {x, y} = placeQuickAccess(panel, frame, workArea);
                window.move_frame(true, x, y);
            });
        });
        this._waitTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, WINDOW_WAIT_SECONDS, () => {
            this._waitTimeoutId = 0;
            this._stopWaiting();
            return GLib.SOURCE_REMOVE;
        });
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
        this._menu = null;
        this._settings = null;
    }
}
