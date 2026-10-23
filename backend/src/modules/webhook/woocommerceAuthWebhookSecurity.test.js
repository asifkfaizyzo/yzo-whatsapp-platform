import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  isWooStoreUrl,
  normalizeWooStoreHost,
  verifyWooAuthEventSignature,
} from './woocommerceAuthWebhookSecurity.js';

test('verifies WooCommerce auth event signatures over timestamp and exact raw request body', () => {
  const secret = 'test-signing-secret';
  const timestamp = '1791360000';
  const rawBody = Buffer.from('{"topic":"customer.login"}');
  const signature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex')}`;
  const nowSeconds = Number(timestamp) + 30;

  assert.equal(verifyWooAuthEventSignature({ secret, timestamp, signature, rawBody, nowSeconds }), true);
  assert.equal(verifyWooAuthEventSignature({
    secret,
    timestamp,
    signature,
    rawBody: Buffer.from('{"topic":"customer.logout"}'),
    nowSeconds,
  }), false);
  assert.equal(verifyWooAuthEventSignature({
    secret,
    timestamp,
    signature,
    rawBody,
    nowSeconds: nowSeconds + 301,
  }), false);
});

test('limits reset links to the configured store host and safe scheme', () => {
  assert.equal(normalizeWooStoreHost('https://www.shop.example/path'), 'shop.example');
  assert.equal(isWooStoreUrl({
    candidate: 'https://shop.example/my-account/lost-password/?key=secret',
    storeUrl: 'https://www.shop.example',
  }), true);
  assert.equal(isWooStoreUrl({
    candidate: 'https://attacker.example/reset',
    storeUrl: 'https://shop.example',
  }), false);
  assert.equal(isWooStoreUrl({
    candidate: 'http://shop.example/reset',
    storeUrl: 'https://shop.example',
  }), false);
  assert.equal(isWooStoreUrl({
    candidate: 'http://shop.example/reset',
    storeUrl: 'https://shop.example',
    allowHttp: true,
  }), true);
});
