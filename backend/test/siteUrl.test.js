import test from 'node:test';
import assert from 'node:assert/strict';
import { getFrontendBaseUrl, getBackendBaseUrl } from '../src/utils/siteUrl.js';


test('uses configured frontend domain when FRONTEND_URL is present', () => {
  const previous = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://app.example.com';

  try {
    assert.equal(getFrontendBaseUrl(), 'https://app.example.com');
  } finally {
    if (previous === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previous;
  }
});

test('falls back to production domain when env is missing', () => {
  const previous = process.env.FRONTEND_URL;
  delete process.env.FRONTEND_URL;

  try {
    assert.equal(getFrontendBaseUrl(), 'https://souqak-yem.com');
    assert.equal(getBackendBaseUrl(), 'https://souqak-yem.com');
  } finally {
    if (previous === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previous;
  }
});
