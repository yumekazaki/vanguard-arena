'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPersonaRideCardIds, renderArtifact, OUTPUT_FILE } = require('./build-persona-ride-metadata.js');

const ROOT = path.resolve(__dirname, '..');

test('Persona Ride metadata is deterministic, generated from CardStat source flags, and loaded before the server reducer', () => {
  const ids = buildPersonaRideCardIds();
  assert.equal(ids.length, 785);
  assert.ok(ids.includes('cfa-10400'));
  assert.ok(!ids.includes('cfa-13707'));
  assert.equal(fs.readFileSync(path.join(ROOT, OUTPUT_FILE), 'utf8'), renderArtifact(ids));

  const metadata = require(path.join(ROOT, OUTPUT_FILE));
  assert.deepEqual(metadata.ids, ids);
  assert.equal(metadata.has('cfa-10400'), true);
  assert.equal(metadata.has('cfa-13707'), false);

  const worker = fs.readFileSync(path.join(ROOT, 'supabase/functions/match-worker/index.ts'), 'utf8');
  assert.ok(worker.indexOf('card-persona-ride-metadata.js') < worker.indexOf('ability-server-reducer.js'));
});
