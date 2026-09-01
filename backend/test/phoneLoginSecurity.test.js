import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  isValidPhoneNumber,
  isValidPassword,
  generateTemporaryPassword,
  buildPasswordResetRequestMessage
} from '../src/utils/securityRules.js';

test('normalizePhone strips non digits and preserves 9-digit Yemen format', () => {
  assert.equal(normalizePhone('966771234567'), '771234567');
  assert.equal(normalizePhone('+967 771 234 567'), '771234567');
  assert.equal(normalizePhone('77123456a'), '77123456');
});

test('phone validation accepts exactly 9 digits and rejects shorter or longer values', () => {
  assert.equal(isValidPhoneNumber('771234567'), true);
  assert.equal(isValidPhoneNumber('77123456'), false);
  assert.equal(isValidPhoneNumber('7712345678'), false);
  assert.equal(isValidPhoneNumber('abc'), false);
});

test('password validation enforces length between 8 and 24 characters', () => {
  assert.equal(isValidPassword('Abc12345'), true);
  assert.equal(isValidPassword('short'), false);
  assert.equal(isValidPassword('A'.repeat(25)), false);
});

test('temporary password is generated in the required size with no predictable pattern', () => {
  const pwd = generateTemporaryPassword();
  assert.equal(pwd.length >= 15 && pwd.length <= 20, true);
  assert.match(pwd, /[A-Za-z0-9]/);
});

test('reset request message contains username and phone details', () => {
  const message = buildPasswordResetRequestMessage('ahmed', '771234567');
  assert.match(message, /ahmed/i);
  assert.match(message, /771234567/);
  assert.match(message, /استعادة كلمة المرور|password reset/i);
});
