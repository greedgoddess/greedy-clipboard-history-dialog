/* extension.js — entry point of Greedy Clipboard History Dialog
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original Clipboard History code is unchanged, in upstream-extension.js.
 * This class extends it and adds "Open at mouse pointer" after it has built
 * its panel button, the hover preview, the optional password manager
 * integration and large spacing, and the update notifications.
 * See docs/cursor-follow.md#cursor-follow-entry-point
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import UpstreamExtension from './upstream-extension.js';
import {CursorFollow} from './cursorFollow.js';
import {FEATURES} from './features.js';
import {HoverPreview} from './hoverPreview.js';
import {PrivateHistory} from './privateHistory.js';
import {clearAtLogin} from './clearAtLogin.js';
import {UpdateNotifier} from './updateNotifier.js';

// [cursor-follow:entry-point]
export default class GreedyClipboardHistoryExtension extends UpstreamExtension {
    enable() {
        // [clear-at-login:entry-point] Before the original starts and loads
        // the history. See docs/clear-at-login.md#clear-at-login-clear
        try {
            clearAtLogin(this.uuid, this.getSettings());
        } catch (error) {
            console.warn(`${this.uuid}: could not clear the history at login: ${error.message}`);
        }

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

        // [private-history:entry-point] The original has created its history
        // folder by now. See docs/private-history.md#private-history-apply
        this._privateHistory = new PrivateHistory(this.uuid, this.getSettings());

        // [hover-preview:entry-point] See docs/hover-preview.md#hover-preview-entry-point
        this._hoverPreview = new HoverPreview(indicator?.menu, this.getSettings(),
            this.dir.get_child('hoverPreview.css'));

        // [password-manager:entry-point] Only when installed with
        // --with-password-managers; otherwise its files are not there at all.
        // See docs/password-managers.md#password-manager-entry-point
        this._greedyEnabled = true;
        if (FEATURES.passwordManagers) {
            import('./passwordManagerSwitch.js').then(({PasswordManagerSwitch}) => {
                if (!this._greedyEnabled)
                    return;
                this._passwordManagers = new PasswordManagerSwitch(indicator?.menu, this.getSettings());
                // Both load in the background; if Large spacing was ready
                // first, it adds the password manager buttons now.
                this._largeSpacing?.refresh();
            }).catch(error => console.warn(`${this.uuid}: password manager integration not loaded: ${error.message}`));
        }

        // [large-spacing:entry-point] Only when installed with --with-large-spacing.
        // See docs/large-spacing.md#large-spacing-entry-point
        if (FEATURES.largeSpacing) {
            import('./largeSpacing.js').then(({LargeSpacing}) => {
                if (this._greedyEnabled) {
                    this._largeSpacing = new LargeSpacing(indicator?.menu, this.getSettings(),
                        this.dir.get_child('largeSpacing.css'), () => this._passwordManagers ?? null);
                }
            }).catch(error => console.warn(`${this.uuid}: large spacing not loaded: ${error.message}`));
        }

        this._updateNotifier = new UpdateNotifier(this, this.getSettings());
    }

    disable() {
        this._greedyEnabled = false;
        this._updateNotifier?.destroy();
        this._updateNotifier = null;
        this._largeSpacing?.destroy();
        this._largeSpacing = null;
        this._passwordManagers?.destroy();
        this._passwordManagers = null;
        this._hoverPreview?.destroy();
        this._hoverPreview = null;
        this._privateHistory?.destroy();
        this._privateHistory = null;
        this._cursorFollow?.destroy();
        this._cursorFollow = null;
        super.disable();
    }
}
