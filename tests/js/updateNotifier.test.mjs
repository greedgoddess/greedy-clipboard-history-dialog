// updateNotifier.test.mjs — unit tests of feature/updateNotifier.js, with
// stand-ins for GLib timers, Soup requests and GNOME notifications.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {UpdateNotifier} = await import('../../feature/updateNotifier.js');

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const COMMIT = 'a'.repeat(40);

function fakeSettings(values) {
    const handlers = [];
    return {
        values,
        get_boolean: key => values[key], get_int64: key => values[key] ?? 0, get_string: key => values[key] ?? '',
        set_int64: (key, value) => { values[key] = value; }, set_string: (key, value) => { values[key] = value; },
        connect: (signal, handler) => handlers.push(handler), disconnect() {},
        toggle(on) { values['update-notifications'] = on; handlers.forEach(h => h()); },
    };
}

function setup({developer = true, enabled = true} = {}) {
    globalThis.__now = 1_000_000;
    globalThis.__notifications.length = 0;
    globalThis.__pending.length = 0;
    globalThis.__runTimers();
    globalThis.__buildInfo = {upstream_version: 3, feature_commit: COMMIT};
    const settings = fakeSettings({'update-notifications': enabled, 'developer-mode': developer,
        'checkout-path': '/home/user/repo'});
    const notifier = new UpdateNotifier({uuid: 'test', path: '/ext'}, settings);
    return {settings, notifier};
}
const tested = version => [{version, shell_versions: ['51']}];

test('off: no check is scheduled and no request is made', () => {
    const {notifier} = setup({enabled: false});
    assert.equal(globalThis.__runTimers(), 0);
    assert.equal(globalThis.__pending.length, 0);
    notifier.destroy();
});

test('developer machine: a new untested release is notified once', async () => {
    const {notifier} = setup();
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(3)); await tick();
    globalThis.__answer('extension-info', {shell_version_map: {51: {version: 4}}}); await tick();
    assert.equal(globalThis.__notifications.length, 1);
    assert.match(globalThis.__notifications[0].title, /release 4/);

    globalThis.__now += 2 * 86400;
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(3)); await tick();
    globalThis.__answer('extension-info', {shell_version_map: {51: {version: 4}}}); await tick();
    assert.equal(globalThis.__notifications.length, 1, 'the same release is not notified again');
    notifier.destroy();
});

test('switching off during a check cancels it: no notification', async () => {
    const {settings, notifier} = setup();
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(3)); await tick();
    settings.toggle(false);
    globalThis.__answer('extension-info', {shell_version_map: {51: {version: 4}}}); await tick();
    assert.equal(globalThis.__notifications.length, 0);
    assert.equal(globalThis.__runTimers(), 0, 'no further check is scheduled');
    notifier.destroy();
});

test('switching on again after cancelling checks normally', async () => {
    const {settings, notifier} = setup();
    globalThis.__runTimers();
    settings.toggle(false);
    globalThis.__answer('tested-releases', tested(3)); await tick();
    settings.toggle(true);
    globalThis.__now += 86400;
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(3)); await tick();
    globalThis.__answer('extension-info', {shell_version_map: {51: {version: 4}}}); await tick();
    assert.equal(globalThis.__notifications.length, 1);
    notifier.destroy();
});

test('user machine: an update in the repository is notified', async () => {
    const {notifier} = setup({developer: false});
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(4)); await tick(); await tick();
    globalThis.__answer('commits', [{sha: COMMIT}]); await tick();
    assert.equal(globalThis.__notifications.length, 1);
    assert.match(globalThis.__notifications[0].body, /update\.sh/);
    notifier.destroy();
});

test('user machine: nothing new, no notification', async () => {
    const {notifier} = setup({developer: false});
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(3)); await tick(); await tick();
    globalThis.__answer('commits', [{sha: COMMIT}]); await tick();
    assert.equal(globalThis.__notifications.length, 0);
    notifier.destroy();
});

test('unexpected answers are skipped, not notified', async () => {
    const {notifier} = setup();
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', {not: 'a list'}); await tick(); await tick();
    assert.equal(globalThis.__notifications.length, 0);
    globalThis.__now += 86400;
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(3)); await tick();
    globalThis.__answer('extension-info', {shell_version_map: {51: {version: 'four'}}}); await tick();
    assert.equal(globalThis.__notifications.length, 0);
    notifier.destroy();
});

test('disabling the extension during a check: no notification, nothing scheduled', async () => {
    const {notifier} = setup();
    globalThis.__runTimers();
    globalThis.__answer('tested-releases', tested(3)); await tick();
    notifier.destroy();
    globalThis.__answer('extension-info', {shell_version_map: {51: {version: 4}}}); await tick();
    assert.equal(globalThis.__notifications.length, 0);
    assert.equal(globalThis.__runTimers(), 0);
});
