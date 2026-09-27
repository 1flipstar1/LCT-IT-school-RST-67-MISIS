import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import test from 'node:test';
import { challengeFor } from '../src/auth/keycloak.js';

const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const expected = createHash('sha256').update(verifier).digest('base64url');

test('PKCE S256 challenge works without secure-context WebCrypto', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
  });
  try {
    assert.equal(await challengeFor(verifier), expected);
  } finally {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    else delete globalThis.crypto;
  }
});

test('PKCE S256 challenge matches WebCrypto in secure contexts', async () => {
  assert.equal(await challengeFor(verifier), expected);
});
