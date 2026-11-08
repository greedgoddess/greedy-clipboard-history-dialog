// quickAccess.test.mjs — unit tests of the 1Password Quick Access switch:
// what the shortcut does, where Quick Access is placed, and when the feature
// is available. Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {shortcutAction, placeQuickAccess, isOnePasswordWindow} = await import('../../feature/quickAccess.js');
const {quickAccessAvailability} = await import('../../feature/onePassword.js');

test('the shortcut toggles the panel, and switches only when on and the panel is open', () => {
    assert.equal(shortcutAction(false, false), 'toggle');
    assert.equal(shortcutAction(false, true), 'toggle');
    assert.equal(shortcutAction(true, false), 'toggle');
    assert.equal(shortcutAction(true, true), 'switch');
});

const workArea = {x: 0, y: 32, width: 1920, height: 1048};

test('Quick Access takes the panel\'s place: left edges aligned, bottom edges level', () => {
    const panel = {x: 400, y: 300, width: 420, height: 500};
    assert.deepEqual(placeQuickAccess(panel, {width: 750, height: 450}, workArea), {x: 400, y: 350});
});

test('Quick Access stays inside the work area', () => {
    assert.deepEqual(placeQuickAccess({x: 1700, y: 40, width: 420, height: 100}, {width: 750, height: 450}, workArea),
        {x: 1170, y: 32});
});

test('1Password windows are recognised by their class', () => {
    assert.ok(isOnePasswordWindow('1Password'));
    assert.ok(isOnePasswordWindow('1password'));
    assert.ok(!isOnePasswordWindow('firefox'));
    assert.ok(!isOnePasswordWindow(null));
});

test('availability: not installed', async () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep'};
    globalThis.__files = {};
    const result = await quickAccessAvailability();
    assert.equal(result.available, false);
    assert.match(result.reason, /not installed/);
});

test('availability: installed but not running', async () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep'};
    globalThis.__files = {'/opt/1Password/1password': true};
    globalThis.__running = false;
    const result = await quickAccessAvailability();
    assert.equal(result.available, false);
    assert.match(result.reason, /not running/);
});

test('availability: installed and running', async () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep', '1password': '/usr/bin/1password'};
    globalThis.__running = true;
    const result = await quickAccessAvailability();
    assert.equal(result.available, true);
    assert.deepEqual(result.command, ['/usr/bin/1password', '--quick-access']);
});

test('availability: Flatpak', async () => {
    globalThis.__programs = {pgrep: '/usr/bin/pgrep', flatpak: '/usr/bin/flatpak'};
    globalThis.__files = {'/var/lib/flatpak/app/com.onepassword.OnePassword': true};
    globalThis.__running = true;
    const result = await quickAccessAvailability();
    assert.deepEqual(result.command, ['/usr/bin/flatpak', 'run', 'com.onepassword.OnePassword', '--quick-access']);
});

test('availability: cannot check without pgrep', async () => {
    globalThis.__programs = {'1password': '/usr/bin/1password'};
    const result = await quickAccessAvailability();
    assert.equal(result.available, false);
    assert.match(result.reason, /pgrep/);
});
