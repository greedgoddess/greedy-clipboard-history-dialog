// passwordManagers.test.mjs — unit tests of the password manager integration:
// the provider registry and detection, which password managers are enabled,
// what the shortcut does, and where a search window is placed.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {PROVIDERS, providerById, availability, findCommand, isProviderWindow} =
    await import('../../feature/passwordManagers.js');
const {enabledProviders, shortcutAction, panelAnchor, placeWindow} =
    await import('../../feature/passwordManagerSwitch.js');

const onePassword = providerById('1password');

test('the registry: 1Password is the only supported password manager for now', () => {
    assert.deepEqual(PROVIDERS.map(p => p.id), ['1password']);
    for (const provider of PROVIDERS) {
        for (const field of ['id', 'name', 'windowName', 'openArgs', 'processName', 'windowClass', 'desktopIds', 'links'])
            assert.ok(provider[field], `${provider.id} has ${field}`);
    }
});

test('enabled password managers: any number, in registry order, unknown IDs ignored', () => {
    assert.deepEqual(enabledProviders([]), []);
    assert.deepEqual(enabledProviders(['1password']).map(p => p.id), ['1password']);
    assert.deepEqual(enabledProviders(['unknown', '1password']).map(p => p.id), ['1password']);
});

test('the shortcut: switches to the chosen password manager only if enabled and the panel is open', () => {
    assert.equal(shortcutAction('', ['1password'], true).action, 'toggle');
    assert.equal(shortcutAction('1password', [], true).action, 'toggle', 'chosen but not enabled');
    assert.equal(shortcutAction('1password', ['1password'], false).action, 'toggle', 'panel closed');
    const result = shortcutAction('1password', ['1password'], true);
    assert.equal(result.action, 'switch');
    assert.equal(result.provider, onePassword);
});

test('windows are recognised by class or app ID', () => {
    assert.ok(isProviderWindow(onePassword, '1Password'));
    assert.ok(isProviderWindow(onePassword, 'com.onepassword.OnePassword'));
    assert.ok(!isProviderWindow(onePassword, 'firefox'));
    assert.ok(!isProviderWindow(onePassword, null));
});

const workArea = {x: 0, y: 32, width: 1920, height: 1048};
const searchWindow = {width: 750, height: 450};

test("anchor: the visible panel's bottom-left corner when it is right of the pointer", () => {
    const panel = {x: 412, y: 390, width: 345, height: 410};
    assert.deepEqual(panelAnchor({x: 400, y: 800}, panel), {x: 412, y: 800, side: 'right', fromPanel: true});
});

test("anchor: the visible panel's bottom-right corner when it was flipped left", () => {
    const panel = {x: 1143, y: 390, width: 345, height: 410};
    assert.deepEqual(panelAnchor({x: 1500, y: 800}, panel), {x: 1488, y: 800, side: 'left', fromPanel: true});
});

test('anchor: the pointer when there is no panel', () => {
    assert.deepEqual(panelAnchor({x: 400, y: 800}, null), {x: 400, y: 800, side: 'right', fromPanel: false});
});

test('placement against the panel: same corner, same distance from the pointer', () => {
    assert.deepEqual(placeWindow({x: 412, y: 800, side: 'right', fromPanel: true}, searchWindow, workArea), {x: 412, y: 350});
    assert.deepEqual(placeWindow({x: 1488, y: 800, side: 'left', fromPanel: true}, searchWindow, workArea), {x: 738, y: 350});
});

test('placement against the panel: kept inside the work area, not flipped', () => {
    assert.deepEqual(placeWindow({x: 1500, y: 800, side: 'right', fromPanel: true}, searchWindow, workArea), {x: 1170, y: 350});
});

test('placement at the pointer: flips left when there is no room on the right', () => {
    assert.deepEqual(placeWindow({x: 1500, y: 800, side: 'right', fromPanel: false}, searchWindow, workArea), {x: 750, y: 350});
});

test('placement near the top: moved down only as far as needed', () => {
    assert.deepEqual(placeWindow({x: 400, y: 100, side: 'right', fromPanel: true}, searchWindow, workArea), {x: 400, y: 32});
});

test('availability: not installed', async () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep'};
    globalThis.__files = {};
    const result = await availability(onePassword);
    assert.equal(result.available, false);
    assert.match(result.reason, /1Password is not installed/);
});

test('availability: installed but not running', async () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep'};
    globalThis.__files = {'/opt/1Password/1password': true};
    globalThis.__running = false;
    const result = await availability(onePassword);
    assert.equal(result.available, false);
    assert.match(result.reason, /not running/);
});

test('availability: installed and running', async () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep', '1password': '/usr/bin/1password'};
    globalThis.__running = true;
    const result = await availability(onePassword);
    assert.equal(result.available, true);
    assert.deepEqual(result.command, ['/usr/bin/1password', '--quick-access']);
});

test('detection: the Flatpak', () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep', flatpak: '/usr/bin/flatpak'};
    globalThis.__files = {'/var/lib/flatpak/app/com.onepassword.OnePassword': true};
    assert.deepEqual(findCommand(onePassword), ['/usr/bin/flatpak', 'run', 'com.onepassword.OnePassword', '--quick-access']);
});

test('availability: cannot check without pgrep', async () => {
    globalThis.__programs = {'1password': '/usr/bin/1password'};
    const result = await availability(onePassword);
    assert.equal(result.available, false);
    assert.match(result.reason, /pgrep/);
});
