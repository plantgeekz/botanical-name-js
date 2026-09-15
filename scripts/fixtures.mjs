// The PHP package (plantgeekz/botanical-name-php) owns fixtures/names.json.
//   node scripts/fixtures.mjs sync   copy it from a sibling checkout
//   node scripts/fixtures.mjs check  fail if our copy differs from the PHP one
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const local = new URL('../fixtures/names.json', import.meta.url);
const sibling = new URL('../../botanical-name-php/fixtures/names.json', import.meta.url);
const remote = 'https://raw.githubusercontent.com/plantgeekz/botanical-name-php/main/fixtures/names.json';

async function source() {
  if (existsSync(sibling)) {
    return readFileSync(sibling, 'utf8');
  }
  const res = await fetch(remote);
  if (!res.ok) {
    throw new Error(`Could not fetch ${remote}: HTTP ${res.status}`);
  }
  return res.text();
}

const mode = process.argv[2];
const upstream = await source();

if (mode === 'sync') {
  writeFileSync(local, upstream);
  console.log('fixtures/names.json synced from the PHP package');
} else if (mode === 'check') {
  if (readFileSync(local, 'utf8') !== upstream) {
    console.error('fixtures/names.json differs from the PHP package - run: npm run sync-fixtures');
    process.exit(1);
  }
  console.log('fixtures/names.json matches the PHP package');
} else {
  console.error('Usage: node scripts/fixtures.mjs sync|check');
  process.exit(2);
}
