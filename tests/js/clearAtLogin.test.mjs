// clearAtLogin.test.mjs — unit tests of clearing unpinned entries at login,
// on an in-memory file system. Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {clearAtLogin, keepPinned} = await import('../../feature/clearAtLogin.js');

const UUID = 'greedy-clipboard-history-dialog@greedgoddess';
const CACHE = `/home/user/.cache/${UUID}`;
const INDEX = `${CACHE}/history.json`;
const MARKER = `/run/user/1000/${UUID}/session-started`;
const settings = on => ({get_boolean: () => on});
const history = () => [
    {id: '1', type: 'text', text: 'pinned', pinned: true},
    {id: '2', type: 'text', text: 'not pinned', pinned: false},
    {id: '3', type: 'image', imagePath: `${CACHE}/images/3.png`, pinned: false},
    {id: '4', type: 'image', imagePath: `${CACHE}/images/4.png`, pinned: true},
];
const freshLogin = () => {
    globalThis.__fs = {[INDEX]: JSON.stringify(history()), [`${CACHE}/images/3.png`]: 'png', [`${CACHE}/images/4.png`]: 'png'};
};

test('keeps pinned entries; removes only images of removed entries inside the images folder', () => {
    const entries = [...history(), {id: '5', type: 'image', imagePath: '/home/user/Pictures/photo.png', pinned: false},
        {id: '6', type: 'image', imagePath: `${CACHE}/images/../../important`, pinned: false}];
    const {kept, removedImages} = keepPinned(entries, `${CACHE}/images`);
    assert.deepEqual(kept.map(e => e.id), ['1', '4']);
    assert.deepEqual(removedImages, [`${CACHE}/images/3.png`]);
});

test('on, first start of a login: unpinned entries and their images go', () => {
    freshLogin();
    assert.equal(clearAtLogin(UUID, settings(true)), true);
    assert.deepEqual(JSON.parse(globalThis.__fs[INDEX]).map(e => e.id), ['1', '4']);
    assert.ok(!(`${CACHE}/images/3.png` in globalThis.__fs));
    assert.ok(`${CACHE}/images/4.png` in globalThis.__fs);
    assert.ok(MARKER in globalThis.__fs);
});

test('screen unlock (same session): nothing is cleared again', () => {
    freshLogin();
    globalThis.__fs[MARKER] = '';
    assert.equal(clearAtLogin(UUID, settings(true)), false);
    assert.equal(JSON.parse(globalThis.__fs[INDEX]).length, 4);
});

test('off: nothing is cleared, but the session is marked', () => {
    freshLogin();
    assert.equal(clearAtLogin(UUID, settings(false)), false);
    assert.equal(JSON.parse(globalThis.__fs[INDEX]).length, 4);
    assert.ok(MARKER in globalThis.__fs, 'switching it on later does not clear mid-session');
});

test('no history yet, or an unexpected file: left untouched', () => {
    globalThis.__fs = {};
    assert.equal(clearAtLogin(UUID, settings(true)), false);
    globalThis.__fs = {[INDEX]: '{"not": "a list"}'};
    assert.equal(clearAtLogin(UUID, settings(true)), false);
    assert.equal(globalThis.__fs[INDEX], '{"not": "a list"}');
});
