// privateHistory.test.mjs — unit tests of the private history folder.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {PrivateHistory, nextMode} = await import('../../feature/privateHistory.js');

const UUID = 'greedy-clipboard-history-dialog@greedgoddess';
const FOLDER = `/home/user/.cache/${UUID}`;
function fakeSettings(on, previous = -1) {
    const handlers = [];
    const values = {'private-history-previous-mode': previous};
    return {
        values,
        get_boolean: () => on, get_int: key => values[key], set_int: (key, value) => { values[key] = value; },
        connect: (signal, handler) => handlers.push(handler), disconnect() {},
        set(value) { on = value; handlers.forEach(h => h()); },
    };
}

test('decision: private sets 700 and remembers the mode before, once', () => {
    assert.deepEqual(nextMode(true, 0o755, -1), {mode: 0o700, remember: 0o755});
    assert.deepEqual(nextMode(true, 0o750, 0o755), {mode: 0o700, remember: null}, 'keeps the first one remembered');
    assert.deepEqual(nextMode(true, 0o700, -1), {mode: null, remember: null}, 'already private: nothing to do');
});

test('decision: switched off restores exactly the remembered mode, never a fixed default', () => {
    assert.deepEqual(nextMode(false, 0o700, 0o750), {mode: 0o750, remember: -1});
    assert.deepEqual(nextMode(false, 0o700, -1), {mode: null, remember: null}, 'nothing remembered: left as it is');
});

test('on: the history folder becomes owner-only, and its previous mode is remembered', () => {
    globalThis.__modes = {[FOLDER]: 0o755};
    const settings = fakeSettings(true);
    const history = new PrivateHistory(UUID, settings);
    assert.equal(globalThis.__modes[FOLDER], 0o700);
    assert.equal(settings.values['private-history-previous-mode'], 0o755);
    history.destroy();
});

test('switching off restores the previous mode; a restrictive one stays restrictive', () => {
    globalThis.__modes = {[FOLDER]: 0o750};
    const settings = fakeSettings(true);
    const history = new PrivateHistory(UUID, settings);
    settings.set(false);
    assert.equal(globalThis.__modes[FOLDER], 0o750, 'not widened to 755');
    assert.equal(settings.values['private-history-previous-mode'], -1);
    settings.set(true);
    assert.equal(globalThis.__modes[FOLDER], 0o700);
    history.destroy();
});

test('a folder that was already private stays private when switched off', () => {
    globalThis.__modes = {[FOLDER]: 0o700};
    const settings = fakeSettings(true);
    const history = new PrivateHistory(UUID, settings);
    settings.set(false);
    assert.equal(globalThis.__modes[FOLDER], 0o700);
    history.destroy();
});

test('no history folder yet: nothing happens', () => {
    globalThis.__modes = {};
    const history = new PrivateHistory(UUID, fakeSettings(true));
    assert.deepEqual(globalThis.__modes, {});
    history.destroy();
});
