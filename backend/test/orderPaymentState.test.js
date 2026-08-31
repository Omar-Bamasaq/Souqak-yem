import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReplacementPaymentDetails,
  clearRejectedPaymentDetails
} from '../src/utils/orderPaymentState.js';

test('buildReplacementPaymentDetails replaces previous proofs instead of appending', () => {
  const previous = [
    { transactionNumber: 'OLD-1', receiptImage: 'receipts/old1.webp' },
    { transactionNumber: 'OLD-2', receiptImage: 'receipts/old2.webp' }
  ];

  const next = [
    { transactionNumber: 'NEW-1', receiptImage: 'receipts/new1.webp' },
    { transactionNumber: 'NEW-2', receiptImage: 'receipts/new2.webp' }
  ];

  const result = buildReplacementPaymentDetails('بنك الكريمي', next, previous);

  assert.deepEqual(result.payments, next);
  assert.equal(result.bankName, 'بنك الكريمي');
  assert.equal(result.payments.length, 2);
});

test('clearRejectedPaymentDetails removes all submitted proof data', () => {
  const rejected = clearRejectedPaymentDetails({
    bankName: 'بنك الكريمي',
    payments: [
      { transactionNumber: 'OLD-1', receiptImage: 'receipts/old1.webp' }
    ],
    submittedAt: new Date('2026-01-01T00:00:00.000Z')
  });

  assert.equal(rejected.bankName, '');
  assert.deepEqual(rejected.payments, []);
  assert.equal(rejected.submittedAt, null);
});
