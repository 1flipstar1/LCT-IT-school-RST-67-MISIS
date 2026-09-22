/** Export the frontend's deterministic demo state for first backend startup. */
import { writeFile } from 'node:fs/promises';

const sourceUrl = new URL('../../frontend/src/data/seed.js', import.meta.url);
const targetUrl = new URL('../app/seed_state.json', import.meta.url);
const { createSeedState } = await import(sourceUrl.href);
const snapshot = createSeedState(new Date('2026-09-22T09:00:00+03:00'));

await writeFile(targetUrl, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Exported seed version ${snapshot.version} to ${targetUrl.pathname}`);
