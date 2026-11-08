/* largeSpacing.js — larger touch targets for the clipboard panel
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * With the 'large-spacing' setting on, the panel gets one fixed size on every
 * tab, a compact tab bar with icons instead of names, and rounded corners that
 * match a password manager's search window (sizes in largeSpacing.css), and
 * the menu entries at the bottom ("Extension Settings…", "Clear (except
 * pinned)") are replaced by a row of icon buttons. The buttons trigger the
 * original entries, so they behave exactly as before. Buttons for the enabled
 * password managers come first.
 * Explained section by section in docs/large-spacing.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const CLEAR_LABEL = /^Clear\b/;
const SETTINGS_LABEL = /^Extension Settings/;
const SCROLL_VIEW_CLASS = 'clipboard-history-scrollview';
const SEARCH_CLASS = 'clipboard-history-search';
const SEARCH_ROW_CLASS = 'greedy-spacing-search-row';
const TAB_BAR_CLASS = 'clipboard-history-tabbar';
const PANEL_CLASS = 'greedy-large-spacing-panel';
const LARGE_SPACING_CLASS = 'greedy-large-spacing';

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
const EMOJI_BUTTON_CLASS = 'clipboard-history-emoji-button';

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

/** A password manager's app icon, looked up in GNOME Shell's app registry,
 * which answers quietly when an ID is not installed (a native package and a
 * Flatpak use different IDs). */
function findAllByStyleClass(actor, styleClass, found = []) {
    if (actor.has_style_class_name?.(styleClass))
        found.push(actor);
    for (const child of actor.get_children?.() ?? [])
        findAllByStyleClass(child, styleClass, found);
    return found;
}

function appIcon(desktopIds) {
    const appSystem = Shell.AppSystem?.get_default?.();
    for (const id of desktopIds) {
        const icon = appSystem?.lookup_app(id)?.get_icon();
        if (icon)
            return icon;
    }
    return new Gio.ThemedIcon({name: 'dialog-password-symbolic'});
}

export class LargeSpacing {
    /** [large-spacing:install]
     * menu: the original's panel menu; stylesheet: largeSpacing.css;
     * passwordManagers: a function returning the PasswordManagerSwitch, or
     * null when that integration is not installed or not loaded yet.
     * See docs/large-spacing.md#large-spacing-install */
    constructor(menu, settings, stylesheet, passwordManagers) {
        this._menu = menu;
        this._settings = settings;
        this._passwordManagers = passwordManagers;
        this._applied = false;
        this.active = Boolean(menu);
        if (!menu)
            return;

        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        this._stylesheet = stylesheet;
        this._theme.load_stylesheet(stylesheet);

        this._settingsIds = ['changed::large-spacing', 'changed::password-managers']
            .map(signal => settings.connect(signal, () => this._update()));
        // [large-spacing:provider-indicator] Whether each password manager is
        // running is checked whenever the panel opens.
        // See docs/large-spacing.md#large-spacing-provider-buttons
        this._openId = menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refreshProviderButtons();
        });
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
        // [large-spacing:provider-buttons] One button per enabled password
        // manager, with its app icon.
        // See docs/large-spacing.md#large-spacing-provider-buttons
        const passwordManagers = this._passwordManagers?.();
        this._providerButtons = (passwordManagers?.enabledProviders() ?? []).map(provider => {
            const button = this._providerButton(provider, () => this._passwordManagers?.()?.open(provider));
            return {provider, button};
        });
        const optional = this._providerButtons.map(({button}) => button);
        const settingsButton = this._button(new Gio.ThemedIcon({name: 'emblem-system-symbolic'}),
            'Extension Settings', () => settings.activate(null));
        // [large-spacing:clear-keeps-open] Clearing runs the original's
        // action, but the panel stays open: GNOME closes a menu when one of
        // its entries is activated, which is skipped for this one call.
        // See docs/large-spacing.md#large-spacing-apply
        const clearButton = this._button(new Gio.ThemedIcon({name: 'user-trash-symbolic'}),
            'Clear (except pinned)', () => {
                const menu = this._menu;
                const own = Object.hasOwn(menu, 'itemActivated') ? menu.itemActivated : null;
                menu.itemActivated = () => {};
                try {
                    clear.activate(null);
                } finally {
                    if (own)
                        menu.itemActivated = own;
                    else
                        delete menu.itemActivated;
                }
            });
        // As in the original design: the trash can shows exactly when the
        // original shows "Clear", which it hides when there is nothing to
        // clear (all pinned, or a tab without history).
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
        this._menu.box.add_style_class_name(LARGE_SPACING_CLASS);
        // [large-spacing:corners] The panel's rounded corners, matching a
        // password manager's search window. See docs/large-spacing.md#large-spacing-corners
        this._menu.actor?.add_style_class_name(PANEL_CLASS);
        // The search field's row has no class of its own; it gets one so that
        // its side padding can go and the field spans the list's width.
        this._searchRow = findByStyleClass(this._menu.box, SEARCH_CLASS)?.get_parent() ?? null;
        this._searchRow?.add_style_class_name(SEARCH_ROW_CLASS);
        this._swapTabLabels();
        this._scrollView = findByStyleClass(this._menu.box, SCROLL_VIEW_CLASS);
        if (this._scrollView) {
            this._scrollViewExpand = this._scrollView.y_expand;
            this._scrollView.y_expand = true;
        }
        // [large-spacing:emoji-rows] Emoji and symbols keep their natural
        // width and line up from the left in each category, instead of being
        // spread over the row. See docs/large-spacing.md#large-spacing-layout
        this._emojiButtons = findAllByStyleClass(this._menu.box, EMOJI_BUTTON_CLASS)
            .map(button => ({button, xExpand: button.x_expand}));
        for (const {button} of this._emojiButtons)
            button.x_expand = false;
        this._applied = true;
        this._refreshProviderButtons();
    }

    /** A button with the password manager's icon, and a small red dot in its
     * corner that shows while the app is not running. */
    _providerButton(provider, onClick) {
        const icon = new St.Icon({gicon: appIcon(provider.desktopIds), style_class: 'greedy-spacing-icon'});
        const dot = new St.Widget({
            style_class: 'greedy-spacing-indicator',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START,
            visible: false,
        });
        const content = new St.Widget({layout_manager: new Clutter.BinLayout(), x_expand: true});
        content.add_child(icon);
        content.add_child(dot);
        const button = this._button(null, `${provider.name} ${provider.windowName}`, onClick, content);
        return Object.assign(button, {providerIcon: icon, providerDot: dot});
    }

    /** Greys out each password manager's icon and shows its red dot while
     * the app is not running. Indicator only: the buttons stay clickable,
     * and the shortcut keeps working. */
    async _refreshProviderButtons() {
        const passwordManagers = this._passwordManagers?.();
        for (const entry of this._providerButtons ?? []) {
            const running = await passwordManagers?.isRunning(entry.provider);
            if (!this._providerButtons?.includes(entry))
                continue;    // Rebuilt or switched off meanwhile
            const off = running === false;
            const icon = entry.button.providerIcon;
            // Greyed out: colours removed and faded; colours back when running.
            if (off && !icon.get_effect('greedy-greyed-out'))
                icon.add_effect_with_name('greedy-greyed-out', new Clutter.DesaturateEffect({factor: 1.0}));
            else if (!off)
                icon.remove_effect_by_name('greedy-greyed-out');
            icon.opacity = off ? 140 : 255;
            entry.button.providerDot.visible = off;
        }
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

    _button(gicon, name, onClick, child = null) {
        const button = new St.Button({
            style_class: 'greedy-spacing-button',
            child: child ?? new St.Icon({gicon, style_class: 'greedy-spacing-icon'}),
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
        this._menu.box.remove_style_class_name(LARGE_SPACING_CLASS);
        this._menu.actor?.remove_style_class_name(PANEL_CLASS);
        this._searchRow?.remove_style_class_name(SEARCH_ROW_CLASS);
        this._searchRow = null;
        for (const {button, xExpand} of this._emojiButtons ?? [])
            button.x_expand = xExpand;
        this._emojiButtons = null;
        this._providerButtons = null;
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
        this._menu.disconnect(this._openId);
        this._theme.unload_stylesheet(this._stylesheet);
        this._menu = null;
        this._settings = null;
        this._passwordManagers = null;
    }
}
