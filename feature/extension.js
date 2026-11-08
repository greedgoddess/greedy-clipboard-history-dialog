/* extension.js — entry point of Greedy Clipboard History Dialog
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original Clipboard History code is unchanged, in upstream-extension.js.
 * This class extends it and adds "Open at mouse pointer" after it has built
 * its panel button, the switch to 1Password Quick Access, and the update
 * notifications.
 * See docs/cursor-follow.md#cursor-follow-entry-point
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import UpstreamExtension from './upstream-extension.js';
import {CursorFollow} from './cursorFollow.js';
import {FEATURES} from './features.js';
import {UpdateNotifier} from './updateNotifier.js';

// [cursor-follow:entry-point]
export default class GreedyClipboardHistoryExtension extends UpstreamExtension {
    enable() {
        super.enable();

        // [cursor-follow:find-menu]
        // Panel buttons are registered under the role passed to
        // Main.panel.addToStatusArea(); the original passes its UUID. The
        // original's own field is the fallback.
        // See docs/cursor-follow.md#cursor-follow-find-menu
        const indicator = Main.panel.statusArea[this.uuid] ?? this._indicator;
        this._cursorFollow = new CursorFollow(indicator?.menu, this.getSettings());
        if (!this._cursorFollow.active)
            console.warn(`${this.uuid}: panel menu not found; "Open at mouse pointer" is inactive`);

        // [quick-access:entry-point] Only when installed with --with-1password;
        // otherwise its files are not there at all.
        // See docs/quick-access.md#quick-access-entry-point
        this._greedyEnabled = true;
        if (FEATURES.quickAccess) {
            import('./quickAccess.js').then(({QuickAccessSwitch}) => {
                if (this._greedyEnabled)
                    this._quickAccess = new QuickAccessSwitch(indicator?.menu, this.getSettings());
            }).catch(error => console.warn(`${this.uuid}: 1Password integration not loaded: ${error.message}`));
        }

        this._updateNotifier = new UpdateNotifier(this, this.getSettings());
    }

    disable() {
        this._greedyEnabled = false;
        this._updateNotifier?.destroy();
        this._updateNotifier = null;
        this._quickAccess?.destroy();
        this._quickAccess = null;
        this._cursorFollow?.destroy();
        this._cursorFollow = null;
        super.disable();
    }
}
