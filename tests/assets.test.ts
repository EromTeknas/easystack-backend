import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_ASSET_ALLOWED_MIME_TYPES,
  STORAGE_PRESETS,
} from '../src/config/storage.presets';
import { FreePlan } from '../src/services/billing/config/plans/free.plan';
import { ProPlan } from '../src/services/billing/config/plans/pro.plan';
import { Quotas } from '../src/services/billing/config/quotas.config';

test('Project Assets - Allowed MIME types contains images and videos', () => {
  const sampleImages = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif',
  ];
  const sampleVideos = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/ogg',
  ];

  for (const img of sampleImages) {
    assert.strictEqual(
      PROJECT_ASSET_ALLOWED_MIME_TYPES.includes(img as any),
      true,
      `MIME type ${img} must be allowed`
    );
  }

  for (const vid of sampleVideos) {
    assert.strictEqual(
      PROJECT_ASSET_ALLOWED_MIME_TYPES.includes(vid as any),
      true,
      `MIME type ${vid} must be allowed`
    );
  }
});

test('Project Assets - storage preset configures public multiple assets slot', () => {
  const preset = STORAGE_PRESETS['project-asset'];
  assert.ok(preset, 'project-asset preset must exist');
  assert.strictEqual(preset.slot, 'assets');
  assert.strictEqual(preset.policy.visibility, 'PUBLIC');
  assert.strictEqual(preset.policy.cardinality, 'MULTIPLE');
  assert.strictEqual(preset.policy.maxSizeBytes, 100 * 1024 * 1024);
  assert.strictEqual(preset.policy.cacheControl, 'public, max-age=31536000, immutable');
});

test('Project Assets - Billing plans define storage quotas', () => {
  assert.strictEqual(
    (FreePlan.quotas as any)[Quotas.ASSET_STORAGE_MB.key],
    50,
    'Free plan must have 50 MB asset storage limit'
  );

  assert.strictEqual(
    (ProPlan.quotas as any)[Quotas.ASSET_STORAGE_MB.key],
    2048,
    'Pro plan must have 2048 MB asset storage limit'
  );
});

test('Project Assets - Storage usage and quota math calculates accurately', () => {
  const limitMB = 50;
  const limitBytes = limitMB * 1024 * 1024; // 52,428,800 bytes

  const usedBytes = 26214400; // 25 MB
  const percentage = Number(((usedBytes / limitBytes) * 100).toFixed(1));
  assert.strictEqual(percentage, 50.0);

  const incomingBytes = 30000000; // ~28.6 MB
  const wouldExceed = usedBytes + incomingBytes > limitBytes;
  assert.strictEqual(wouldExceed, true, '25MB + 28.6MB must exceed 50MB quota');

  const fitsBytes = 10000000; // ~9.5 MB
  const wouldFit = usedBytes + fitsBytes > limitBytes;
  assert.strictEqual(wouldFit, false, '25MB + 9.5MB must fit within 50MB quota');
});
