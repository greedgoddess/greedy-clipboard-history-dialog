/* passwordManagerSwitch.js — from the clipboard panel to a password manager
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Part of the optional password manager integration. GNOME closes a panel
 * menu as soon as another window takes the keyboard, and a password manager's
 * search window (such as 1Password Quick Access) hides as soon as it loses it,
 * so the two cannot be open at the same time. The second press of the
 * clipboard shortcut while the panel is open closes the panel and opens the
 * password manager chosen in the preferences, where the panel was. The
 * buttons in Large spacing open any enabled one the same way.
 * Explained section by section in docs/password-managers.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {PROVIDERS, availability, isProviderWindow, isRunning, providerById} from './passwordManagers.js';
import {CornerRounder} from './roundedCorners.js';

// The original extension's keybinding, in its settings schema.
const SHORTCUT_KEY = 'toggle-shortcut';
// A search window can take several seconds to appear; give up waiting after this.
const WINDOW_WAIT_SECONDS = 15;
// If the app moves its window itself right after showing it, put it back
// during this long.
const KEEP_IN_PLACE_MS = 1500;

/** [password-manager:enabled]
 * The enabled password managers, in the order of PROVIDERS: the ones whose
 * IDs are in the 'password-managers' setting. Any number, or all.
 * See docs/password-managers.md#password-manager-settings */
export function enabledProviders(enabledIds) {
    return PROVIDERS.filter(provider => enabledIds.includes(provider.id));
}

/** [password-manager:shortcut-action]
 * What the shortcut does: 'switch' to the password manager chosen for the
 * shortcut, if it is enabled and the panel is open; otherwise 'toggle' the
 * panel, as the original does. Returns {action, provider}.
 * See docs/password-managers.md#password-manager-shortcut */
export function shortcutAction(shortcutId, enabledIds, panelOpen) {
    const provider = enabledIds.includes(shortcutId) ? providerById(shortcutId) : null;
    return provider && panelOpen ? {action: 'switch', provider} : {action: 'toggle', provider: null};
}

/** [password-manager:anchor]
 * The corner the search window is placed against: the visible panel's
 * bottom-left corner when the panel is to the right of the pointer, its
 * bottom-right corner when it was flipped to the left. Without a panel, the
 * pointer. A GNOME panel menu is an invisible outer box around the visible
 * one, which is why the visible panel, not the pointer, is used: then the
 * window sits exactly where the panel was, at the same distance from the
 * pointer. pointer is {x, y}; panel is the visible box or null.
 * See docs/password-managers.md#password-manager-placement */
export function panelAnchor(pointer, panel) {
    if (!panel)
        return {x: pointer.x, y: pointer.y, side: 'right', fromPanel: false};
    const leftOfPointer = panel.x + panel.width <= pointer.x;
    return leftOfPointer
        ? {x: panel.x + panel.width, y: panel.y + panel.height, side: 'left', fromPanel: true}
        : {x: panel.x, y: panel.y + panel.height, side: 'right', fromPanel: true};
}

/** [password-manager:placement]
 * Where the search window goes: its bottom-left corner on the anchor (side
 * 'right'), or its bottom-right corner (side 'left'). Anchored at the
 * pointer, it goes to the left instead when there is no room on the right,
 * like the panel; anchored at the panel, it stays against the panel. Either
 * way it is then moved only as far as needed to stay inside the monitor's
 * work area. window and workArea are {x, y, width, height}.
 * See docs/password-managers.md#password-manager-placement */
export function placeWindow(anchor, window, workArea) {
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

export class PasswordManagerSwitch {
    /** [password-manager:shortcut]
     * Takes over the original's shortcut with the same settings and action
     * modes, so that its handler can decide between toggling the panel and
     * switching to a password manager.
     * See docs/password-managers.md#password-manager-shortcut */
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

    /** The enabled password managers, for the buttons in Large spacing. */
    enabledProviders() {
        return enabledProviders(this._settings.get_strv('password-managers'));
    }

    /** Whether the provider's app is running; for the buttons' indicator. */
    isRunning(provider) {
        return isRunning(provider, this._cancellable);
    }

    /** Opens the provider's search window where the panel is, as the second
     * press of the shortcut does; used by the buttons in Large spacing. */
    open(provider) {
        this._switchTo(provider).catch(error => console.warn(`Password manager: ${error.message}`));
    }

    _onShortcut() {
        const {action, provider} = shortcutAction(this._settings.get_string('shortcut-password-manager'),
            this._settings.get_strv('password-managers'), this._menu.isOpen);
        if (action === 'switch')
            this.open(provider);
        else
            this._menu.toggle();
    }

    /** [password-manager:switch]
     * Notes where the pointer and the visible panel are, closes the panel,
     * checks that the provider is installed and running, then opens its
     * search window and waits for it.
     * See docs/password-managers.md#password-manager-switch */
    async _switchTo(provider) {
        const [x, y] = global.get_pointer();
        let panel = null;
        if (this._menu.isOpen) {
            const [px, py] = this._menu.box.get_transformed_position();
            const [width, height] = this._menu.box.get_transformed_size();
            panel = {x: px, y: py, width, height};
        }
        const anchor = panelAnchor({x, y}, panel);
        this._menu.close();

        const status = await availability(provider, this._cancellable);
        if (this._cancellable.is_cancelled())
            return;
        if (!status.available) {
            Main.notify(`${provider.name} ${provider.windowName} is not available`, status.reason);
            return;
        }
        this._placeNextWindow(provider, anchor);
        Gio.Subprocess.new(status.command, Gio.SubprocessFlags.NONE);
    }

    /** Moves the next window of the provider that appears to its place at
     * the anchor, and keeps it there briefly in case the app moves it itself.
     * A window has no class yet when it is created, so each new window is
     * checked when it is shown. */
    _placeNextWindow(provider, anchor) {
        this._stopWaiting();
        this._windowCreatedId = global.display.connect('window-created', (_display, window) => {
            const shownId = window.connect('shown', () => {
                window.disconnect(shownId);
                if (!this._windowCreatedId || !isProviderWindow(provider, window.get_wm_class()))
                    return;
                this._stopWaiting();
                this._keepInPlace(window, anchor);
                // Rounded corners are part of Large spacing.
                if (this._settings.get_boolean('large-spacing')) {
                    try {
                        if (!this._cornerRounder.round(window))
                            console.warn('Password manager: this GNOME Shell has no shader API for rounded corners');
                    } catch (error) {
                        console.warn(`Password manager: corners not rounded: ${error.message}`);
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
            return placeWindow(anchor, frame, workArea);
        };
        const move = () => {
            const {x, y} = target();
            const frame = window.get_frame_rect();
            if (frame.x !== x || frame.y !== y)
                window.move_frame(true, x, y);
        };
        move();
        // Moves by the app itself, and size changes, are corrected for a
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

    /** [password-manager:cleanup]
     * Stops waiting for a window and cancels a running check. The shortcut
     * itself is removed by the original's disable(), which runs next.
     * See docs/password-managers.md#password-manager-cleanup */
    destroy() {
        this._cancellable.cancel();
        this._stopWaiting();
        this._stopKeeping?.();
        this._cornerRounder.destroy();
        this._menu = null;
        this._settings = null;
    }
}
