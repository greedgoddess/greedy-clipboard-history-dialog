// hoverPreview.test.mjs — unit tests of the hover preview: the text shown,
// where it goes, and which entries have one.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {previewText, placePreview, findTextEntry, MAX_PREVIEW_CHARS} = await import('../../feature/hoverPreview.js');

test('text: short entries are shown whole', () => {
    assert.equal(previewText('hello'), 'hello');
});

test('text: cut after 512 characters, with an ellipsis', () => {
    const long = 'a'.repeat(600);
    assert.equal(MAX_PREVIEW_CHARS, 512);
    assert.equal(previewText(long), `${'a'.repeat(512)}…`);
    assert.equal(previewText('b'.repeat(512)), 'b'.repeat(512), 'exactly 512: no ellipsis');
});

test('text: counted in characters, so emoji and accents are never split', () => {
    const text = '😀'.repeat(600);
    assert.equal([...previewText(text)].length, 513);
});

const workArea = {x: 0, y: 32, width: 1920, height: 1048};
const panel = {x: 400, y: 300, width: 345, height: 472};

test('placement: right of the panel, level with the entry', () => {
    assert.deepEqual(placePreview({x: 410, y: 420, width: 330, height: 36}, panel, {width: 420, height: 200}, workArea),
        {x: 753, y: 420});
});

test('placement: left of the panel when there is no room on the right', () => {
    const rightPanel = {...panel, x: 1500};
    assert.deepEqual(placePreview({x: 1510, y: 420, width: 330, height: 36}, rightPanel, {width: 420, height: 200}, workArea),
        {x: 1072, y: 420});
});

test('placement: kept inside the work area at the bottom', () => {
    assert.deepEqual(placePreview({x: 410, y: 1000, width: 330, height: 36}, panel, {width: 420, height: 200}, workArea),
        {x: 753, y: 880});
});

test('entries: text entries have a preview, image entries and other actors do not', () => {
    const textItem = {entry: {type: 'text', text: 'copied'}, get_parent: () => null};
    const label = {get_parent: () => textItem};
    const imageItem = {entry: {type: 'image', imagePath: '/x.png'}, get_parent: () => null};
    assert.equal(findTextEntry(label), textItem);
    assert.equal(findTextEntry(textItem), textItem);
    assert.equal(findTextEntry({get_parent: () => imageItem}), null);
    assert.equal(findTextEntry(null), null);
});
