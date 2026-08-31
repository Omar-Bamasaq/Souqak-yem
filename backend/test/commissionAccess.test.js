import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasOutstandingCommission,
  getBlockingCommissionSummary
} from '../src/utils/commissionAccess.js';

const unpaid = [{ status: 'unpaid', commissionAmount: 5000 }];
const overdue = [{ status: 'overdue', commissionAmount: 8000 }];
const paid = [{ status: 'paid', commissionAmount: 5000 }];

test('hasOutstandingCommission returns true for unpaid commissions', () => {
  assert.equal(hasOutstandingCommission(unpaid), true);
});

test('hasOutstandingCommission returns true for overdue commissions', () => {
  assert.equal(hasOutstandingCommission(overdue), true);
});

test('hasOutstandingCommission returns false for paid commissions', () => {
  assert.equal(hasOutstandingCommission(paid), false);
});

test('getBlockingCommissionSummary returns counts and first unpaid item', () => {
  const result = getBlockingCommissionSummary([
    { status: 'unpaid', commissionAmount: 1000 },
    { status: 'overdue', commissionAmount: 2000 },
    { status: 'paid', commissionAmount: 3000 }
  ]);

  assert.equal(result.hasOutstanding, true);
  assert.equal(result.unpaidCount, 1);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.totalAmount, 3000);
  assert.equal(result.firstUnpaidAdId, undefined);
});

test('approved commission clears the outstanding block', () => {
  const result = getBlockingCommissionSummary([
    { status: 'paid', commissionStatus: 'approved', commissionAmount: 1000 }
  ]);

  assert.equal(result.hasOutstanding, false);
  assert.equal(result.blockingCount, 0);
});
