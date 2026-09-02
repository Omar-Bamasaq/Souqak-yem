import test from 'node:test';
import assert from 'node:assert/strict';
import ImageUploadService from '../src/services/imageUploadService.js';

test('allows SVG files for category uploads', () => {
  const filter = ImageUploadService.getFileFilter();
  let accepted = false;
  let error = null;

  filter({}, { originalname: 'category-icon.svg', mimetype: 'image/svg+xml' }, (err, isAccepted) => {
    error = err;
    accepted = isAccepted;
  });

  assert.equal(error, null);
  assert.equal(accepted, true);
});

test('recognizes SVG content as a valid image buffer', () => {
  const svgBuffer = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal(ImageUploadService.isImageBuffer(svgBuffer), true);
});
