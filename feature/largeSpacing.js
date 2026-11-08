/* largeSpacing.js — larger touch targets for the clipboard panel
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * With the 'large-spacing' setting on, the panel gets one fixed size on every
 * tab and a taller tab bar with icons instead of names (sizes in
 * largeSpacing.css), and the menu entries at the bottom ("Extension Settings…",
 * "Clear (except pinned)") are replaced by a row of icon buttons. The buttons trigger the
 * original entries, so they behave exactly as before. Optional entries, such
 * as 1Password Quick Access, come first.
 * Explained section by section in docs/large-spacing.md.
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
const TAB_BAR_CLASS = 'clipboard-history-tabbar';
const TOUCH_MODE_CLASS = 'greedy-large-spacing';

/** [large-spacing:tab-icons]
 * Icon for each tab, by the tab's name; each with fallbacks, the first one
 * the icon theme has is used. Tabs with other names keep their text.
 * See docs/large-spacing.md#large-spacing-tab-icons */
export const TAB_ICONS = {
    Text: ['text-x-generic-symbolic', 'format-text-plaintext-symbolic', 'edit-paste-symbolic'],
    Images: ['image-x-generic-symbolic', 'camera-photo-symbolic'],
    Emoji: ['emoji-people-symbolic', 'face-smile-symbolic'],
    Kaomoji: ['face-wink-symbolic', 'face-smile-big-symbolic', 'emoji-body-symbolic'],
    Symbols: ['emoji-symbols-symbolic', 'insert-text-symbolic'],
};
const ONE_PASSWORD_DESKTOP_IDS = ['1password.desktop', 'com.onepassword.OnePassword.desktop'];

/** [large-spacing:find-actions]
 * The original's two menu entries, recognised by their labels.
 * items: the menu's children; each may have a label with text.
 * See docs/large-spacing.md#large-spacing-find-actions */
export function findMenuActions(items) {
    const byLabel = pattern => items.find(item => pattern.test(item?.label?.text ?? '')) ?? null;
    return {settings: byLabel(SETTINGS_LABEL), clear: byLabel(CLEAR_LABEL)};
}

/** [large-spacing:button-order]
 * Optional entries first, then settings, then clear.
 * See docs/large-spacing.md#large-spacing-button-order */
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

export class LargeSpacing {
    /** [large-spacing:install]
     * menu: the original's panel menu; stylesheet: largeSpacing.css;
     * quickAccess: a function returning the QuickAccessSwitch, or null.
     * See docs/large-spacing.md#large-spacing-install */
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

        this._settingsIds = ['changed::large-spacing', 'changed::quick-access']
            .map(signal => settings.connect(signal, () => this._update()));
        this._update();
    }

    _update() {
        const on = this._settings.get_boolean('large-spacing');
        if (this._applied)
            this._unapply();
        if (on)
            this._apply();
    }

    /** [large-spacing:apply]
     * Takes the two original entries out of the menu (keeping them, and their
     * places) and puts the row of buttons there instead.
     * See docs/large-spacing.md#large-spacing-apply */
    _apply() {
        const children = this._menu.box.get_children();
        const {settings, clear} = findMenuActions(children);
        if (!settings || !clear) {
            console.warn('Large spacing: the original menu entries were not found; large spacing is inactive');
            return;
        }
        this._originals = [settings, clear]
            .map(item => ({item, index: children.indexOf(item)}))
            .sort((a, b) => a.index - b.index);
        for (const {item} of this._originals)
            this._menu.box.remove_child(item);

        const buttons = new St.BoxLayout({style_class: 'greedy-spacing-buttons', x_expand: true});
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

        // [large-spacing:layout] Fixed sizes from largeSpacing.css; the list takes
        // the remaining height, so the panel keeps its size when a tab hides
        // the search row. See docs/large-spacing.md#large-spacing-layout
        this._menu.box.add_style_class_name(TOUCH_MODE_CLASS);
        this._swapTabLabels();
        this._scrollView = findByStyleClass(this._menu.box, SCROLL_VIEW_CLASS);
        if (this._scrollView) {
            this._scrollViewExpand = this._scrollView.y_expand;
            this._scrollView.y_expand = true;
        }
        this._applied = true;
    }

    /** Replaces each tab's name with its icon; the name stays as the
     * accessible name, and is put back by _unapply(). */
    _swapTabLabels() {
        const tabBar = findByStyleClass(this._menu.box, TAB_BAR_CLASS);
        this._tabLabels = [];
        for (const tab of tabBar?.get_children() ?? []) {
            const label = tab.label;
            const names = TAB_ICONS[label];
            if (!names)
                continue;
            this._tabLabels.push({tab, label, accessibleName: tab.accessible_name});
            tab.set_child(new St.Icon({
                gicon: Gio.ThemedIcon.new_from_names(names),
                style_class: 'greedy-spacing-tab-icon',
            }));
            tab.accessible_name = label;
        }
    }

    _button(gicon, name, onClick) {
        const button = new St.Button({
            style_class: 'greedy-spacing-button',
            child: new St.Icon({gicon, style_class: 'greedy-spacing-icon'}),
            accessible_name: name,
            can_focus: true,
            x_expand: true,
        });
        button.connect('clicked', onClick);
        return button;
    }

    /** [large-spacing:unapply]
     * Puts the original entries back in their places and the panel back to
     * the original's sizes.
     * See docs/large-spacing.md#large-spacing-unapply */
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
        for (const {tab, label, accessibleName} of this._tabLabels ?? []) {
            tab.label = label;    // Replaces the icon with the name again
            tab.accessible_name = accessibleName;
        }
        this._tabLabels = null;
        this._menu.box.remove_style_class_name(TOUCH_MODE_CLASS);
        if (this._scrollView)
            this._scrollView.y_expand = this._scrollViewExpand;
        this._scrollView = null;
        this._applied = false;
    }

    /** [large-spacing:cleanup]
     * See docs/large-spacing.md#large-spacing-cleanup */
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
