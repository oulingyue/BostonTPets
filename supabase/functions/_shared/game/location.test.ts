import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkScanLocation, distanceMeters, MAX_ACCURACY_CREDIT_M, parseScanLocation, type CodePlace } from './location.ts';

// Park Street and Downtown Crossing: neighbouring downtown stations about 400 m apart.
const PARK_STREET = { lat: 42.35639, lng: -71.0624 };
const DOWNTOWN_CROSSING = { lat: 42.355518, lng: -71.060225 };
const HARVARD = { lat: 42.373362, lng: -71.118956 };

const parkStreetCode: CodePlace = { ...PARK_STREET, radius_m: 250 };
const at = (p: { lat: number; lng: number }, accuracy: number | null = 10) => ({ ...p, accuracy, mocked: false });

test('distanceMeters matches known distances', () => {
  assert.equal(distanceMeters(PARK_STREET, PARK_STREET), 0);
  // Park Street to Harvard is about 5 km in a straight line.
  const km = distanceMeters(PARK_STREET, HARVARD) / 1000;
  assert.ok(km > 4.9 && km < 5.1, `got ${km} km`);
  // 0.001° of latitude is about 111 m anywhere on Earth.
  const m = distanceMeters({ lat: 42, lng: -71 }, { lat: 42.001, lng: -71 });
  assert.ok(Math.abs(m - 111.2) < 0.5, `got ${m} m`);
  // Symmetric
  assert.equal(distanceMeters(PARK_STREET, HARVARD), distanceMeters(HARVARD, PARK_STREET));
});

test('a code without coordinates skips the check, even with no location', () => {
  assert.deepEqual(checkScanLocation({ lat: null, lng: null, radius_m: 250 }, null), { ok: true });
});

test('a located code needs a location', () => {
  assert.deepEqual(checkScanLocation(parkStreetCode, null), { ok: false, reason: 'missing' });
});

test('a mock location is refused even at the right spot', () => {
  assert.deepEqual(checkScanLocation(parkStreetCode, { ...at(PARK_STREET), mocked: true }), { ok: false, reason: 'mocked' });
});

test('on the spot and inside the radius pass', () => {
  assert.deepEqual(checkScanLocation(parkStreetCode, at(PARK_STREET)), { ok: true });
  // About 200 m north, inside the 250 m radius.
  assert.deepEqual(checkScanLocation(parkStreetCode, at({ lat: 42.35819, lng: -71.0624 })), { ok: true });
});

test('across town is too far, with the distance rounded to a meter', () => {
  const verdict = checkScanLocation(parkStreetCode, at(HARVARD));
  assert.equal(verdict.ok, false);
  assert.ok(!verdict.ok && verdict.reason === 'too_far');
  assert.equal(verdict.distanceM, Math.round(distanceMeters(PARK_STREET, HARVARD)));
});

test("the phone's uncertainty stretches the radius, up to the cap", () => {
  // About 300 m north: outside 250 m on its own.
  const p = { lat: 42.35909, lng: -71.0624 };
  const d = distanceMeters(p, PARK_STREET);
  assert.ok(d > 290 && d < 310);
  assert.equal(checkScanLocation(parkStreetCode, at(p, 10)).ok, false);
  assert.equal(checkScanLocation(parkStreetCode, at(p, null)).ok, false);
  // An uncertainty of 60 m covers the extra ~50 m.
  assert.equal(checkScanLocation(parkStreetCode, at(p, 60)).ok, true);

  // A vague cell-tower fix only gets the capped credit.
  const far = { lat: 42.36, lng: -71.0624 }; // about 400 m north
  assert.ok(distanceMeters(far, PARK_STREET) > 250 + MAX_ACCURACY_CREDIT_M);
  assert.equal(checkScanLocation(parkStreetCode, at(far, 3000)).ok, false);
});

test("the radius is the code's own", () => {
  const nearby = at(DOWNTOWN_CROSSING);
  assert.equal(checkScanLocation({ ...PARK_STREET, radius_m: 100 }, nearby).ok, false);
  assert.equal(checkScanLocation({ ...PARK_STREET, radius_m: 500 }, nearby).ok, true);
});

test('parseScanLocation accepts a well-formed location', () => {
  assert.deepEqual(parseScanLocation({ lat: 42.3, lng: -71.1, accuracy: 12.5, mocked: false }), {
    lat: 42.3,
    lng: -71.1,
    accuracy: 12.5,
    mocked: false,
  });
  // Accuracy and mocked are optional.
  assert.deepEqual(parseScanLocation({ lat: 0, lng: 0 }), { lat: 0, lng: 0, accuracy: null, mocked: false });
  assert.equal(parseScanLocation({ lat: 1, lng: 1, mocked: true })?.mocked, true);
});

test('parseScanLocation treats malformed input as no location', () => {
  for (const bad of [
    undefined,
    null,
    'here',
    42,
    {},
    { lat: 42.3 },
    { lat: '42.3', lng: '-71.1' },
    { lat: Number.NaN, lng: 0 },
    { lat: 0, lng: Number.POSITIVE_INFINITY },
    { lat: 91, lng: 0 },
    { lat: 0, lng: -181 },
  ]) {
    assert.equal(parseScanLocation(bad), null, JSON.stringify(bad));
  }
});

test('parseScanLocation drops a nonsense accuracy and only trusts mocked === true', () => {
  assert.equal(parseScanLocation({ lat: 1, lng: 1, accuracy: -5 })?.accuracy, null);
  assert.equal(parseScanLocation({ lat: 1, lng: 1, accuracy: 'big' })?.accuracy, null);
  assert.equal(parseScanLocation({ lat: 1, lng: 1, mocked: 'yes' })?.mocked, false);
});
