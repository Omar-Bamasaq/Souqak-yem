import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('prerender script exists for public SEO routes', () => {
  const prerenderPath = path.join(process.cwd(), 'scripts', 'prerender.mjs');
  assert.ok(fs.existsSync(prerenderPath), 'Expected prerender script to exist');
});
