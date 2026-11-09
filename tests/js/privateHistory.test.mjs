// privateHistory.test.mjs — unit tests of the private history folder.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {PrivateHistory, folderMode} = await import('../../feature/privateHistory.js');

const FOLDER = '/home/user/.cache/greedy-clipboard-history-dialog@greedgoddess';
function fakeSettings(on) {
    const handlers = [];
    return {
        get_boolean: () => on, connect: (signal, handler) => handlers.push(handler), disconnect() {},
        set(value) { on = value; handlers.forEach(h => h()); },
    };
}

test('modes: 700 when private, 755 otherwise', () => {
    assert.equal(folderMode(true), 0o700);
    assert.equal(folderMode(false), 0o755);
});

test('on: the history folder becomes owner-only when the extension starts', () => {
    globalThis.__modes = {[FOLDER]: 0o755};
    const history = new PrivateHistory('greedy-clipboard-history-dialog@greedgoddess', fakeSettings(true));
    assert.equal(globalThis.__modes[FOLDER], 0o700);
    history.destroy();
});

test('switching it off restores the default, switching it on again restricts it', () => {
    globalThis.__modes = {[FOLDER]: 0o755};
    const settings = fakeSettings(true);
    const history = new PrivateHistory('greedy-clipboard-history-dialog@greedgoddess', settings);
    settings.set(false);
    assert.equal(globalThis.__modes[FOLDER], 0o755);
    settings.set(true);
    assert.equal(globalThis.__modes[FOLDER], 0o700);
    history.destroy();
});

test('no history folder yet: nothing happens', () => {
    globalThis.__modes = {};
    const history = new PrivateHistory('greedy-clipboard-history-dialog@greedgoddess', fakeSettings(true));
    assert.deepEqual(globalThis.__modes, {});
    history.destroy();
});
