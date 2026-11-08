/* touchMode.js — larger touch targets for the clipboard panel
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * With the 'touch-mode' setting on, the panel gets one fixed size on every
 * tab, twice the font size, a taller tab bar and taller entries (all set in
 * touchMode.css), and the menu entries at the bottom ("Extension Settings…",
 * "Clear (except pinned)") are replaced by a row of icon buttons. The buttons trigger the
 * original entries, so they behave exactly as before. Optional entries, such
 * as 1Password Quick Access, come first.
 * Explained section by section in docs/touch-mode.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gio from 'gi://Gio';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const CLEAR_LABEL = /^Clear\b/;
const SETTINGS_LABEL = /^Extension Settings/;
const SCROLL_VIEW_CLASS = 'clipboard-history-scrollview';
const TOUCH_MODE_CLASS = 'greedy-touch-mode';
const ICON_SIZE = 36;
const ONE_PASSWORD_DESKTOP_IDS = ['1password.desktop', 'com.onepassword.OnePassword.desktop'];

/** [touch-mode:find-actions]
 * The original's two menu entries, recognised by their labels.
 * items: the menu's children; each may have a label with text.
 * See docs/touch-mode.md#touch-mode-find-actions */
export function findMenuActions(items) {
    const byLabel = pattern => items.find(item => pattern.test(item?.label?.text ?? '')) ?? null;
    return {settings: byLabel(SETTINGS_LABEL), clear: byLabel(CLEAR_LABEL)};
}

/** [touch-mode:button-order]
 * Optional entries first, then settings, then clear.
 * See docs/touch-mode.md#touch-mode-button-order */
export function orderButtons(optional, settings, clear) {
    return [...optional, settings, clear];
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

function onePasswordIcon() {
    for (const id of ONE_PASSWORD_DESKTOP_IDS) {
        const icon = Gio.DesktopAppInfo.new(id)?.get_icon();
        if (icon)
            return icon;
    }
    return new Gio.ThemedIcon({name: 'dialog-password-symbolic'});
}

export class TouchMode {
    /** [touch-mode:install]
     * menu: the original's panel menu; stylesheet: touchMode.css;
     * quickAccess: a function returning the QuickAccessSwitch, or null.
     * See docs/touch-mode.md#touch-mode-install */
    constructor(menu, settings, stylesheet, quickAccess) {
        this._menu = menu;
        this._settings = settings;
        this._quickAccess = quickAccess;
        this._applied = false;
        this.active = Boolean(menu);
        if (!menu)
            return;

        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        this._stylesheet = stylesheet;
        this._theme.load_stylesheet(stylesheet);

        this._settingsIds = ['changed::touch-mode', 'changed::quick-access']
            .map(signal => settings.connect(signal, () => this._update()));
        this._update();
    }

    _update() {
        const on = this._settings.get_boolean('touch-mode');
        if (this._applied)
            this._unapply();
        if (on)
            this._apply();
    }

    /** [touch-mode:apply]
     * Takes the two original entries out of the menu (keeping them, and their
     * places) and puts the row of buttons there instead.
     * See docs/touch-mode.md#touch-mode-apply */
    _apply() {
        const children = this._menu.box.get_children();
        const {settings, clear} = findMenuActions(children);
        if (!settings || !clear) {
            console.warn('Touch mode: the original menu entries were not found; touch mode is inactive');
            return;
        }
        this._originals = [settings, clear]
            .map(item => ({item, index: children.indexOf(item)}))
            .sort((a, b) => a.index - b.index);
        for (const {item} of this._originals)
            this._menu.box.remove_child(item);

        const buttons = new St.BoxLayout({style_class: 'greedy-touch-buttons', x_expand: true});
        const optional = [];
        if (this._quickAccess?.() && this._settings.get_boolean('quick-access')) {
            optional.push(this._button(onePasswordIcon(), '1Password Quick Access',
                () => this._quickAccess()?.openQuickAccess()));
        }
        const settingsButton = this._button(new Gio.ThemedIcon({name: 'emblem-system-symbolic'}),
            'Extension Settings', () => settings.activate(null));
        const clearButton = this._button(new Gio.ThemedIcon({name: 'user-trash-symbolic'}),
            'Clear (except pinned)', () => clear.activate(null));
        // The original shows "Clear" only when there is something to clear.
        clearButton.visible = clear.visible;
        this._clearVisibleId = clear.connect('notify::visible', () => {
            clearButton.visible = clear.visible;
        });
        this._clearItem = clear;
        for (const button of orderButtons(optional, settingsButton, clearButton))
            buttons.add_child(button);

        this._row = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        this._row.add_child(buttons);
        this._menu.box.insert_child_at_index(this._row, this._originals[0].index);

        // [touch-mode:layout] Fixed size and larger everything, from
        // touchMode.css; the list takes the remaining height, so the panel
        // keeps its size when a tab hides the search row.
        // See docs/touch-mode.md#touch-mode-layout
        this._menu.box.add_style_class_name(TOUCH_MODE_CLASS);
        this._scrollView = findByStyleClass(this._menu.box, SCROLL_VIEW_CLASS);
        if (this._scrollView) {
            this._scrollViewExpand = this._scrollView.y_expand;
            this._scrollView.y_expand = true;
        }
        this._applied = true;
    }

    _button(gicon, name, onClick) {
        const button = new St.Button({
            style_class: 'greedy-touch-button',
            child: new St.Icon({gicon, icon_size: ICON_SIZE}),
            accessible_name: name,
            can_focus: true,
            x_expand: true,
        });
        button.connect('clicked', onClick);
        return button;
    }

    /** [touch-mode:unapply]
     * Puts the original entries back in their places and the panel back to
     * the original's sizes.
     * See docs/touch-mode.md#touch-mode-unapply */
    _unapply() {
        if (this._clearItem && this._clearVisibleId)
            this._clearItem.disconnect(this._clearVisibleId);
        this._clearVisibleId = 0;
        this._clearItem = null;
        this._row?.destroy();
        this._row = null;
        for (const {item, index} of this._originals ?? [])
            this._menu.box.insert_child_at_index(item, index);
        this._originals = null;
        this._menu.box.remove_style_class_name(TOUCH_MODE_CLASS);
        if (this._scrollView)
            this._scrollView.y_expand = this._scrollViewExpand;
        this._scrollView = null;
        this._applied = false;
    }

    /** [touch-mode:cleanup]
     * See docs/touch-mode.md#touch-mode-cleanup */
    destroy() {
        if (!this.active)
            return;
        if (this._applied)
            this._unapply();
        this._settingsIds.forEach(id => this._settings.disconnect(id));
        this._theme.unload_stylesheet(this._stylesheet);
        this._menu = null;
        this._settings = null;
        this._quickAccess = null;
    }
}
