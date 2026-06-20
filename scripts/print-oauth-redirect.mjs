#!/usr/bin/env node
// Prints Twitch OAuth redirect URIs to register in dev.twitch.tv (Store + pinned dev build).
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAUTH_REDIRECT_URI_STORE } from '../src/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const extensionIdFromPublicKeyDer = (publicKeyDer) => {
  const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
  const hex = hash.subarray(0, 16).toString('hex');
  const alphabet = 'abcdefghijklmnop';
  return [...hex].map((digit) => alphabet[parseInt(digit, 16)]).join('');
};

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

if (!manifest.key) {
  console.error('manifest.json is missing "key" — dev extension ID is not pinned.');
  process.exit(1);
}

const devId = extensionIdFromPublicKeyDer(Buffer.from(manifest.key, 'base64'));
const devRedirect = `https://${devId}.chromiumapp.org/`;

console.log('Register these OAuth Redirect URLs in your Twitch app:\n');
console.log(OAUTH_REDIRECT_URI_STORE);
console.log(devRedirect);
console.log('\nStore build:', OAUTH_REDIRECT_URI_STORE);
console.log('Dev build:  ', devRedirect);
