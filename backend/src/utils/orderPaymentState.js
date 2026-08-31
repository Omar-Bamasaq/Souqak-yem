export function buildReplacementPaymentDetails(bankName, newPayments, previousPayments = []) {
  const sanitizedNew = Array.isArray(newPayments) ? newPayments : [];
  const cleaned = sanitizedNew
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      transactionNumber: String(p.transactionNumber || '').trim(),
      receiptImage: String(p.receiptImage || '').trim()
    }))
    .filter((p) => p.transactionNumber || p.receiptImage);

  return {
    bankName: String(bankName || '').trim(),
    payments: cleaned.slice(0, 5),
    submittedAt: new Date()
  };
}

export function clearRejectedPaymentDetails(currentDetails = {}) {
  const safe = currentDetails && typeof currentDetails === 'object' ? currentDetails : {};

  return {
    bankName: '',
    payments: [],
    submittedAt: null,
    ...safe,
    bankName: '',
    payments: [],
    submittedAt: null
  };
}
