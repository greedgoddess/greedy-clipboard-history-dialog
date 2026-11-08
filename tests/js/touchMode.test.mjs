// touchMode.test.mjs — unit tests of touch mode with a stand-in menu: button
// order, swapping the original entries out and back in, taller tabs.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import St from 'gi://St';
const {TouchMode, findMenuActions, orderButtons, enlargedHeights} = await import('../../feature/touchMode.js');

globalThis.global = {...globalThis.global, stage: {}};

function fakeMenu() {
    const item = text => {
        const entry = new St.Actor({label: {text}});
        entry.activations = 0;
        entry.activate = () => { entry.activations += 1; };
        return entry;
    };
    const tab = natural => new St.Actor({style_class: 'clipboard-history-tab', natural});
    const tabRow = new St.Actor();
    const tabBar = new St.Actor({style_class: 'clipboard-history-tabbar'});
    [tab(30), tab(30), tab(32)].forEach(t => tabBar.add_child(t));
    tabRow.add_child(tabBar);
    const separator = new St.Actor({name: 'separator'});
    const clear = item('Clear (except pinned)');
    const settings = item('Extension Settings…');
    const box = new St.Actor();
    [tabRow, new St.Actor({name: 'list'}), separator, clear, settings].forEach(c => box.add_child(c));
    const menu = new St.Actor({box, isOpen: false});
    return {menu, box, clear, settings, tabBar};
}
const fakeSettings = values => ({
    handlers: {},
    get_boolean: key => values[key],
    connect(signal, handler) { (this.handlers[signal] ??= []).push(handler); return 1; },
    disconnect() {},
    set(key, value) { values[key] = value; (this.handlers[`changed::${key}`] ?? []).forEach(h => h()); },
});
const buttonsOf = box => box.children.find(c => c.children?.[0]?.has_style_class_name('greedy-touch-buttons'))
    ?.children[0].children ?? [];

test('the original entries are found by their labels', () => {
    const {box, clear, settings} = fakeMenu();
    assert.deepEqual(findMenuActions(box.get_children()), {settings, clear});
});

test('order: optional entries first, then settings, then clear', () => {
    assert.deepEqual(orderButtons(['1password'], 'settings', 'clear'), ['1password', 'settings', 'clear']);
    assert.deepEqual(orderButtons([], 'settings', 'clear'), ['settings', 'clear']);
});

test('tabs become exactly twice as tall', () => {
    assert.deepEqual(enlargedHeights([30, 32]), [60, 64]);
});

test('touch mode off: the menu is untouched', () => {
    const {menu, box} = fakeMenu();
    const before = box.get_children();
    const mode = new TouchMode(menu, fakeSettings({'touch-mode': false, 'quick-access': false}), 'css', () => null);
    assert.deepEqual(box.get_children(), before);
    mode.destroy();
});

test('touch mode on: buttons replace the entries, in their place, and trigger them', () => {
    const {menu, box, clear, settings} = fakeMenu();
    const mode = new TouchMode(menu, fakeSettings({'touch-mode': true, 'quick-access': false}), 'css', () => null);
    assert.ok(!box.children.includes(clear) && !box.children.includes(settings));
    assert.equal(box.children[3].children[0].has_style_class_name('greedy-touch-buttons'), true);
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
    const settings = fakeSettings({'touch-mode': true, 'quick-access': true});
    const mode = new TouchMode(menu, settings, 'css', () => quickAccess);
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
    const mode = new TouchMode(menu, fakeSettings({'touch-mode': true, 'quick-access': false}), 'css', () => null);
    clear.visible = false; clear.emit('notify::visible');
    assert.equal(buttonsOf(box).at(-1).visible, false);
    mode.destroy();
});

test('switching off, or disabling, puts the entries and tabs back exactly', () => {
    const {menu, box, tabBar} = fakeMenu();
    const before = box.get_children();
    const settings = fakeSettings({'touch-mode': true, 'quick-access': false});
    const mode = new TouchMode(menu, settings, 'css', () => null);
    menu.isOpen = true; menu.emit('open-state-changed', true);
    assert.deepEqual(tabBar.children.map(t => t.height), [60, 60, 64]);
    settings.set('touch-mode', false);
    assert.deepEqual(box.get_children(), before);
    assert.deepEqual(tabBar.children.map(t => t.height), [-1, -1, -1]);
    settings.set('touch-mode', true);
    mode.destroy();
    assert.deepEqual(box.get_children(), before);
    assert.equal(globalThis.__theme.loaded.length, 0, 'stylesheet unloaded');
});
