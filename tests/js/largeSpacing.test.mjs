// largeSpacing.test.mjs — unit tests of large spacing with a stand-in menu: button
// order, swapping the original entries out and back in, taller tabs.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import St from 'gi://St';
const {LargeSpacing, TAB_ICONS, findMenuActions, orderButtons} = await import('../../feature/largeSpacing.js');

globalThis.global = {...globalThis.global, stage: {}};

function fakeMenu() {
    const item = text => {
        const entry = new St.Actor({label: {text}});
        entry.activations = 0;
        entry.activate = () => { entry.activations += 1; };
        return entry;
    };
    const tabRow = new St.Actor();
    const tabBar = new St.Actor({style_class: 'clipboard-history-tabbar'});
    for (const name of ['Text', 'Images', 'Emoji', 'Kaomoji', 'Symbols']) {
        const tab = new St.Button({style_class: 'clipboard-history-tab'});
        tab.label = name;
        tabBar.add_child(tab);
    }
    tabRow.add_child(tabBar);
    const emojiRow = new St.Actor({style_class: 'clipboard-history-emoji-row'});
    for (const glyph of ['😀', '😃'])
        emojiRow.add_child(new St.Button({style_class: 'clipboard-history-emoji-button', label: glyph, x_expand: true}));
    tabRow.add_child(emojiRow);
    const scrollView = new St.Actor({style_class: 'clipboard-history-scrollview', y_expand: false});
    const searchRow = new St.Actor({style_class: 'popup-menu-item'});
    searchRow.add_child(new St.Actor({style_class: 'clipboard-history-search'}));
    const separator = new St.Actor({name: 'separator'});
    const clear = item('Clear (except pinned)');
    const settings = item('Extension Settings…');
    const box = new St.Actor();
    [tabRow, searchRow, scrollView, separator, clear, settings].forEach(c => box.add_child(c));
    const menu = new St.Actor({box, isOpen: false, actor: new St.Actor({style_class: 'popup-menu-boxpointer'})});
    return {menu, box, clear, settings, scrollView, tabBar, searchRow, emojiRow};
}
const fakeSettings = values => ({
    handlers: {},
    get_boolean: key => values[key],
    connect(signal, handler) { (this.handlers[signal] ??= []).push(handler); return 1; },
    disconnect() {},
    set(key, value) { values[key] = value; (this.handlers[`changed::${key}`] ?? []).forEach(h => h()); },
});
const buttonsOf = box => box.children.find(c => c.children?.[0]?.has_style_class_name('greedy-spacing-buttons'))
    ?.children[0].children ?? [];

test('the original entries are found by their labels', () => {
    const {box, clear, settings} = fakeMenu();
    assert.deepEqual(findMenuActions(box.get_children()), {settings, clear});
});

test('order: optional entries first, then settings, then clear', () => {
    assert.deepEqual(orderButtons(['1password'], 'settings', 'clear'), ['1password', 'settings', 'clear']);
    assert.deepEqual(orderButtons([], 'settings', 'clear'), ['settings', 'clear']);
});

test('large spacing off: the menu is untouched', () => {
    const {menu, box} = fakeMenu();
    const before = box.get_children();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': false, 'password-managers': []}), 'css', () => null);
    assert.deepEqual(box.get_children(), before);
    mode.destroy();
});

test('large spacing on: buttons replace the entries, in their place, and trigger them', () => {
    const {menu, box, clear, settings} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': []}), 'css', () => null);
    assert.ok(!box.children.includes(clear) && !box.children.includes(settings));
    assert.equal(box.children[4].children[0].has_style_class_name('greedy-spacing-buttons'), true);
    const [gear, trash] = buttonsOf(box);
    assert.equal(gear.accessible_name, 'Extension Settings');
    assert.equal(trash.accessible_name, 'Clear (except pinned)');
    gear.emit('clicked'); trash.emit('clicked');
    assert.equal(settings.activations, 1);
    assert.equal(clear.activations, 1);
    mode.destroy();
});

// A stand-in for the password manager integration, as Large spacing sees it.
function fakePasswordManagers({running = true, enabled = ['1password']} = {}) {
    const opened = [];
    const providers = enabled.map(id => ({id, name: '1Password', windowName: 'Quick Access',
        desktopIds: ['1password.desktop', 'com.onepassword.OnePassword.desktop']}));
    return {opened, enabledProviders: () => providers, isRunning: async () => running,
        open: provider => opened.push(provider.id)};
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("a password manager's button uses its app icon, from either package", () => {
    const {menu, box} = fakeMenu();
    globalThis.__apps = {'com.onepassword.OnePassword.desktop': 'flatpak-icon'};
    const pm = fakePasswordManagers();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': ['1password']}), 'css', () => pm);
    assert.equal(buttonsOf(box)[0].providerIcon.gicon, 'flatpak-icon');
    mode.destroy();
    globalThis.__apps = {};
});

test('password manager buttons come first, one per enabled password manager, and open it', () => {
    const {menu, box} = fakeMenu();
    const pm = fakePasswordManagers();
    const settings = fakeSettings({'large-spacing': true, 'password-managers': ['1password']});
    const mode = new LargeSpacing(menu, settings, 'css', () => pm);
    const buttons = buttonsOf(box);
    assert.deepEqual(buttons.map(b => b.accessible_name), ['1Password Quick Access', 'Extension Settings', 'Clear (except pinned)']);
    buttons[0].emit('clicked');
    assert.deepEqual(pm.opened, ['1password']);
    mode.destroy();
});

test('clear keeps the panel open', () => {
    const {menu, box, clear} = fakeMenu();
    let closed = false;
    menu.itemActivated = function () { closed = true; };
    const original = menu.itemActivated;
    clear.activate = () => { clear.activations += 1; menu.itemActivated(); };    // As GNOME's menu does
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': []}), 'css', () => null);
    buttonsOf(box).at(-1).emit('clicked');
    assert.equal(clear.activations, 1);
    assert.equal(closed, false);
    assert.equal(menu.itemActivated, original, 'restored afterwards');
    mode.destroy();
});

test('password managers that finish loading later still get their buttons', () => {
    const {menu, box} = fakeMenu();
    let pm = null;
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': ['1password']}), 'css', () => pm);
    assert.deepEqual(buttonsOf(box).map(b => b.accessible_name), ['Extension Settings', 'Clear (except pinned)']);
    pm = fakePasswordManagers();
    mode.refresh();
    assert.deepEqual(buttonsOf(box).map(b => b.accessible_name), ['1Password Quick Access', 'Extension Settings', 'Clear (except pinned)']);
    mode.destroy();
});

test('no password manager enabled: no extra button', () => {
    const {menu, box} = fakeMenu();
    const pm = fakePasswordManagers({enabled: []});
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': []}), 'css', () => pm);
    assert.deepEqual(buttonsOf(box).map(b => b.accessible_name), ['Extension Settings', 'Clear (except pinned)']);
    mode.destroy();
});

test('not running: the icon is greyed out and the red dot shows; the button stays clickable', async () => {
    const {menu, box} = fakeMenu();
    const pm = fakePasswordManagers({running: false});
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': ['1password']}), 'css', () => pm);
    await tick();
    const [button] = buttonsOf(box);
    assert.equal(button.providerDot.visible, true);
    assert.ok(button.providerIcon.opacity < 255);
    assert.ok(button.providerIcon.get_effect('greedy-greyed-out'), 'colours removed');
    button.emit('clicked');
    assert.deepEqual(pm.opened, ['1password'], 'still opens: indicator only');
    mode.destroy();
});

test('running: full icon, no dot; checked again whenever the panel opens', async () => {
    const {menu, box} = fakeMenu();
    const pm = fakePasswordManagers({running: true});
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': ['1password']}), 'css', () => pm);
    await tick();
    const [button] = buttonsOf(box);
    assert.equal(button.providerDot.visible, false);
    assert.equal(button.providerIcon.opacity, 255);
    assert.equal(button.providerIcon.get_effect('greedy-greyed-out'), null);
    pm.isRunning = async () => false;
    menu.emit('open-state-changed', true);
    await tick();
    assert.equal(button.providerDot.visible, true);
    mode.destroy();
});

test("the trash can shows exactly when the original's Clear entry does", () => {
    const {menu, box, clear} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': []}), 'css', () => null);
    const trash = buttonsOf(box).at(-1);
    assert.equal(trash.visible, true);
    clear.visible = false; clear.emit('notify::visible');
    assert.equal(trash.visible, false);
    clear.visible = true; clear.emit('notify::visible');
    assert.equal(trash.visible, true);
    mode.destroy();
});

test('large spacing on: fixed-size layout class on the panel, the list takes the remaining height', () => {
    const {menu, box, scrollView} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': []}), 'css', () => null);
    assert.ok(box.has_style_class_name('greedy-large-spacing'));
    assert.ok(menu.actor.has_style_class_name('greedy-large-spacing-panel'), 'rounded panel corners');
    assert.equal(scrollView.y_expand, true);
    mode.destroy();
});

test('tabs show icons instead of names, and keep their names for screen readers', () => {
    const {menu, tabBar} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'password-managers': []}), 'css', () => null);
    for (const tab of tabBar.children) {
        assert.ok(tab.child.gicon.names.length > 0, `${tab.label} has an icon`);
        assert.equal(tab.accessible_name, tab.label);
    }
    assert.deepEqual(tabBar.children[2].child.gicon.names, TAB_ICONS.Emoji);
    mode.destroy();
});

test('emoji keep their natural width, lined up from the left, and get it back when switched off', () => {
    const {menu, emojiRow} = fakeMenu();
    const settings = fakeSettings({'large-spacing': true, 'password-managers': []});
    const mode = new LargeSpacing(menu, settings, 'css', () => null);
    assert.deepEqual(emojiRow.children.map(b => b.x_expand), [false, false]);
    settings.set('large-spacing', false);
    assert.deepEqual(emojiRow.children.map(b => b.x_expand), [true, true]);
    mode.destroy();
});

test("the search field's row gets the full-width class, and loses it again", () => {
    const {menu, searchRow} = fakeMenu();
    const settings = fakeSettings({'large-spacing': true, 'password-managers': []});
    const mode = new LargeSpacing(menu, settings, 'css', () => null);
    assert.ok(searchRow.has_style_class_name('greedy-spacing-search-row'));
    settings.set('large-spacing', false);
    assert.ok(!searchRow.has_style_class_name('greedy-spacing-search-row'));
    mode.destroy();
});

test('switching off, or disabling, puts the entries and layout back exactly', () => {
    const {menu, box, scrollView, tabBar} = fakeMenu();
    const before = box.get_children();
    const settings = fakeSettings({'large-spacing': true, 'password-managers': []});
    const mode = new LargeSpacing(menu, settings, 'css', () => null);
    settings.set('large-spacing', false);
    assert.deepEqual(box.get_children(), before);
    assert.ok(!box.has_style_class_name('greedy-large-spacing'));
    assert.ok(!menu.actor.has_style_class_name('greedy-large-spacing-panel'));
    assert.equal(scrollView.y_expand, false);
    assert.deepEqual(tabBar.children.map(t => t.child.text), ['Text', 'Images', 'Emoji', 'Kaomoji', 'Symbols']);
    settings.set('large-spacing', true);
    mode.destroy();
    assert.deepEqual(box.get_children(), before);
    assert.equal(globalThis.__theme.loaded.length, 0, 'stylesheet unloaded');
});
