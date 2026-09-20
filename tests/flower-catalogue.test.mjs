import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const catalogue = JSON.parse(readFileSync(new URL('../lib/flowervision-catalogue.json', import.meta.url)));
test('supplier snapshot has complete, distinct usable names and allowlisted photo URLs', () => {
  assert.equal(catalogue.listings, 423);
  assert.equal(catalogue.flowers.length, 380);
  assert.equal(new Set(catalogue.flowers.map(f => f.name.toLowerCase())).size, catalogue.flowers.length);
  for (const flower of catalogue.flowers) {
    assert.ok(flower.name.trim().length > 0 && flower.name.length <= 160);
    assert.equal(new URL(flower.imageUrl).origin, 'https://shop.flowervisionsouthampton.co.uk');
    assert.ok(new URL(flower.imageUrl).pathname.startsWith('/pictures/'));
    assert.equal(typeof flower.colour, 'string');
  }
});
