import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWooAuthTemplateComponents,
  normalizeWooPhone,
} from './woocommerceAuthMessageService.js';

test('normalizes plausible international WhatsApp phone numbers', () => {
  assert.equal(normalizeWooPhone('+91 98765 43210'), '919876543210');
  assert.equal(normalizeWooPhone('123'), null);
});

test('maps login alert template parameters to customer and login time', () => {
  assert.deepEqual(buildWooAuthTemplateComponents({
    components: [{ type: 'BODY', text: 'Hi {{1}}, new login at {{2}}.' }],
  }, {
    eventType: 'customer.login',
    customerName: 'A Customer',
    occurredAt: '2026-10-07T10:00:00.000Z',
  }), [{
    type: 'body',
    parameters: [
      { type: 'text', text: 'A Customer' },
      { type: 'text', text: '2026-10-07T10:00:00.000Z' },
    ],
  }]);
});

test('supports password reset links in the body or a dynamic URL button', () => {
  const resetUrl = 'https://shop.example/my-account/lost-password/?key=secret';
  assert.deepEqual(buildWooAuthTemplateComponents({
    components: [{ type: 'BODY', text: 'Hi {{1}}, reset here: {{2}}' }],
  }, {
    eventType: 'customer.password_reset_requested',
    customerName: 'A Customer',
    resetUrl,
  }), [{
    type: 'body',
    parameters: [
      { type: 'text', text: 'A Customer' },
      { type: 'text', text: resetUrl },
    ],
  }]);

  const buttonComponents = buildWooAuthTemplateComponents({
    components: [
      { type: 'BODY', text: 'Hi {{1}}, use the button to reset your password.' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://shop.example/my-account/lost-password/?key={{1}}' }] },
    ],
  }, {
    eventType: 'customer.password_reset_requested',
    customerName: 'A Customer',
    resetUrl: 'https://shop.example/my-account/lost-password/?key=secret&login=customer',
  });
  assert.deepEqual(buttonComponents, [
    { type: 'body', parameters: [{ type: 'text', text: 'A Customer' }] },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: 'secret&login=customer' }],
    },
  ]);
});

test('rejects reset templates that do not include a dynamic reset link', () => {
  assert.throws(() => buildWooAuthTemplateComponents({
    components: [{ type: 'BODY', text: 'Hi {{1}}, reset your password.' }],
  }, {
    eventType: 'customer.password_reset_requested',
    customerName: 'A Customer',
    resetUrl: 'https://shop.example/reset',
  }), /must include/);
});
