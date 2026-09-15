// Runs the shared fixtures in fixtures/names.json against the built package.
// The PHP package runs the same file, so both must agree byte for byte.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { format, key, normalize, parse, slug, toHtml } from '../dist/esm/index.js';

const cases = JSON.parse(readFileSync(new URL('../fixtures/names.json', import.meta.url), 'utf8'));

/**
 * Every key in `expected` must match; keys it leaves out are not checked.
 * Arrays must have the same length and match element by element.
 */
function assertSubset(expected, actual, path) {
  if (Array.isArray(expected) && expected.length > 0) {
    assert.ok(Array.isArray(actual), `${path}: expected an array`);
    assert.equal(actual.length, expected.length, `${path}: length`);
    expected.forEach((value, i) => assertSubset(value, actual[i], `${path}[${i}]`));
    return;
  }
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    for (const [k, value] of Object.entries(expected)) {
      assert.ok(actual !== null && k in actual, `${path}.${k}: missing`);
      assertSubset(value, actual[k], `${path}.${k}`);
    }
    return;
  }
  assert.deepEqual(actual, expected, path);
}

describe('shared fixtures', () => {
  cases.forEach((c, i) => {
    it(`#${i} ${c.note ?? c.input}`, () => {
      const name = parse(c.input);

      if ('parse' in c && c.parse === null) {
        assert.equal(name, null, 'Expected the input to be rejected');
        return;
      }
      assert.notEqual(name, null, 'Expected the input to parse');

      if (c.expect) {
        assertSubset(c.expect, name, 'parse');
      }

      const outputs = {
        text: () => format(name),
        textWithAuthors: () => format(name, { authors: true }),
        textTypographic: () => format(name, { typographic: true }),
        html: () => toHtml(name),
        htmlWithAuthors: () => toHtml(name, { authors: true }),
        slug: () => slug(name),
        key: () => key(name),
      };
      for (const [field, produce] of Object.entries(outputs)) {
        if (field in c) {
          assert.equal(produce(), c[field], field);
        }
      }
    });
  });
});

describe('api', () => {
  it('normalize keeps authors', () => {
    assert.equal(
      normalize('hydrangea x macrophylla ssp. serrata (Thunb.) Makino'),
      'Hydrangea ×macrophylla subsp. serrata (Thunb.) Makino',
    );
    assert.equal(normalize(''), null);
  });

  it('em tag for italics', () => {
    assert.equal(toHtml(parse('Rosa canina'), { tag: 'em' }), '<em>Rosa canina</em>');
  });

  it('JSON has the same key order as the PHP toArray()', () => {
    assert.deepEqual(Object.keys(parse('Rosa canina L.')), [
      'verbatim', 'genus', 'genusHybrid', 'graftChimaera', 'epithet', 'speciesHybrid',
      'authorship', 'infraspecific', 'group', 'tradeName', 'cultivar', 'formula', 'warnings',
    ]);
  });

  it('CommonJS build works', () => {
    const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
    assert.equal(cjs.format(cjs.parse('mentha x piperita')), 'Mentha ×piperita');
  });
});
