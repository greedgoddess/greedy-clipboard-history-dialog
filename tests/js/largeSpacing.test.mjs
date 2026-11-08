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
    const scrollView = new St.Actor({style_class: 'clipboard-history-scrollview', y_expand: false});
    const separator = new St.Actor({name: 'separator'});
    const clear = item('Clear (except pinned)');
    const settings = item('Extension Settings…');
    const box = new St.Actor();
    [tabRow, scrollView, separator, clear, settings].forEach(c => box.add_child(c));
    const menu = new St.Actor({box, isOpen: false, actor: new St.Actor({style_class: 'popup-menu-boxpointer'})});
    return {menu, box, clear, settings, scrollView, tabBar};
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
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': false, 'quick-access': false}), 'css', () => null);
    assert.deepEqual(box.get_children(), before);
    mode.destroy();
});

test('large spacing on: buttons replace the entries, in their place, and trigger them', () => {
    const {menu, box, clear, settings} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'quick-access': false}), 'css', () => null);
    assert.ok(!box.children.includes(clear) && !box.children.includes(settings));
    assert.equal(box.children[3].children[0].has_style_class_name('greedy-spacing-buttons'), true);
    const [gear, trash] = buttonsOf(box);
    assert.equal(gear.accessible_name, 'Extension Settings');
    assert.equal(trash.accessible_name, 'Clear (except pinned)');
    gear.emit('clicked'); trash.emit('clicked');
    assert.equal(settings.activations, 1);
    assert.equal(clear.activations, 1);
    mode.destroy();
});

test('the 1Password button comes first, only with the integration and its switch on', () => {
    const {menu, box} = fakeMenu();
    let opened = 0;
    const quickAccess = {openQuickAccess: () => { opened += 1; }};
    const settings = fakeSettings({'large-spacing': true, 'quick-access': true});
    const mode = new LargeSpacing(menu, settings, 'css', () => quickAccess);
    const buttons = buttonsOf(box);
    assert.deepEqual(buttons.map(b => b.accessible_name), ['1Password Quick Access', 'Extension Settings', 'Clear (except pinned)']);
    buttons[0].emit('clicked');
    assert.equal(opened, 1);
    settings.set('quick-access', false);
    assert.deepEqual(buttonsOf(box).map(b => b.accessible_name), ['Extension Settings', 'Clear (except pinned)']);
    mode.destroy();
});

test("the clear button follows the original entry's visibility", () => {
    const {menu, box, clear} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'quick-access': false}), 'css', () => null);
    clear.visible = false; clear.emit('notify::visible');
    assert.equal(buttonsOf(box).at(-1).visible, false);
    mode.destroy();
});

test('large spacing on: fixed-size layout class on the panel, the list takes the remaining height', () => {
    const {menu, box, scrollView} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'quick-access': false}), 'css', () => null);
    assert.ok(box.has_style_class_name('greedy-large-spacing'));
    assert.ok(menu.actor.has_style_class_name('greedy-large-spacing-panel'), 'rounded panel corners');
    assert.equal(scrollView.y_expand, true);
    mode.destroy();
});

test('tabs show icons instead of names, and keep their names for screen readers', () => {
    const {menu, tabBar} = fakeMenu();
    const mode = new LargeSpacing(menu, fakeSettings({'large-spacing': true, 'quick-access': false}), 'css', () => null);
    for (const tab of tabBar.children) {
        assert.ok(tab.child.gicon.names.length > 0, `${tab.label} has an icon`);
        assert.equal(tab.accessible_name, tab.label);
    }
    assert.deepEqual(tabBar.children[2].child.gicon.names, TAB_ICONS.Emoji);
    mode.destroy();
});

test('switching off, or disabling, puts the entries and layout back exactly', () => {
    const {menu, box, scrollView, tabBar} = fakeMenu();
    const before = box.get_children();
    const settings = fakeSettings({'large-spacing': true, 'quick-access': false});
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
