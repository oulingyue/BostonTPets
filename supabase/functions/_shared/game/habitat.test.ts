import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG, HABITATS, HABITAT_OF, TOTAL_PETS, type Habitat } from './catalog.ts';

test('every pet has exactly one habitat, and the map covers the catalog', () => {
  assert.equal(Object.keys(HABITAT_OF).length, TOTAL_PETS);
  const seen = new Set<string>();
  for (const zone of HABITATS) {
    const ids = Object.entries(HABITAT_OF)
      .filter(([, habitat]) => habitat === zone)
      .map(([id]) => id);
    assert.ok(ids.length > 0, zone);
    for (const id of ids) {
      assert.equal(seen.has(id), false, id);
      seen.add(id);
      assert.equal(CATALOG[id]?.habitat, zone);
    }
  }
  assert.equal(seen.size, TOTAL_PETS);
});

test('flyers, swimmers, and walkers land in the zones the habitat shows', () => {
  const zone = (id: string): Habitat => {
    const habitat = CATALOG[id]?.habitat;
    assert.ok(habitat, id);
    return habitat;
  };
  assert.equal(zone('pigeon'), 'sky');
  assert.equal(zone('monarch_butterfly'), 'sky');
  assert.equal(zone('snowy_owl'), 'sky');
  assert.equal(zone('mallard_duck'), 'water');
  assert.equal(zone('snapping_turtle'), 'water');
  assert.equal(zone('humpback_whale'), 'water');
  assert.equal(zone('lobster'), 'water');
  assert.equal(zone('red_fox'), 'earth');
  assert.equal(zone('wild_turkey'), 'earth');
});
