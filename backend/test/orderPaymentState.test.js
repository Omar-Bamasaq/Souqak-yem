import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaymentProofTransition,
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

test('payment proof transition only claims orders that are awaiting payment', () => {
  const paymentDetails = {
    bankName: 'بنك الكريمي',
    payments: [{ transactionNumber: 'TX-1', receiptImage: 'receipts/proof.webp' }],
    submittedAt: new Date('2026-10-27T00:00:00.000Z')
  };
  const transition = buildPaymentProofTransition('order-1', 'buyer-1', paymentDetails);

  assert.deepEqual(transition.filter, {
    _id: 'order-1',
    buyer: 'buyer-1',
    orderType: { $ne: 'store' },
    storeProfileId: null,
    status: 'AWAITING_PAYMENT'
  });
  assert.equal(transition.update.$set.status, 'AWAITING_PAYMENT_CONFIRMATION');
  assert.equal(transition.update.$set.paymentDetails, paymentDetails);

  const compareAndSet = (currentStatus) => (
    currentStatus === transition.filter.status
      ? transition.update.$set.status
      : null
  );
  assert.equal(compareAndSet('AWAITING_PAYMENT'), 'AWAITING_PAYMENT_CONFIRMATION');
  for (const status of ['PENDING_SELLER_APPROVAL', 'AWAITING_PAYMENT_CONFIRMATION', 'PAID_CONFIRMED', 'SHIPPED', 'DELIVERED', 'DISPUTED']) {
    assert.equal(compareAndSet(status), null, `${status} must not accept another payment proof`);
  }
});
