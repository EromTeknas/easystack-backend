import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { ApiKeyAuthService } from '../src/delivery/services/api-key-auth.service';
import { DeliveryContentService } from '../src/delivery/services/delivery-content.service';
import { apiKeyAuthMiddleware } from '../src/delivery/middlewares/api-key-auth.middleware';
import { redisClient } from '../src/db/redis';

after(async () => {
  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
});

test('Delivery API - SHA-256 key hashing is deterministic and non-reversible', () => {
  const rawKey1 = 'es_live_0123456789abcdef0123456789abcdef';
  const rawKey2 = 'es_live_0123456789abcdef0123456789abcdef';
  const rawKey3 = 'es_dev_0123456789abcdef0123456789abcdef';

  const hash1 = ApiKeyAuthService.hashKey(rawKey1);
  const hash2 = ApiKeyAuthService.hashKey(rawKey2);
  const hash3 = ApiKeyAuthService.hashKey(rawKey3);

  assert.strictEqual(hash1, hash2, 'Identical keys must produce identical hashes');
  assert.notStrictEqual(hash1, hash3, 'Different keys must produce distinct hashes');
  assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hexadecimal characters');
});

test('Delivery API - Environment aliases correctly resolve production/live and dev/development', () => {
  const liveAliases = DeliveryContentService.getEnvironmentAliases('live');
  assert.deepStrictEqual(liveAliases, ['live', 'production']);

  const prodAliases = DeliveryContentService.getEnvironmentAliases('production');
  assert.deepStrictEqual(prodAliases, ['live', 'production']);

  const devAliases = DeliveryContentService.getEnvironmentAliases('dev');
  assert.deepStrictEqual(devAliases, ['dev', 'development']);

  const developmentAliases = DeliveryContentService.getEnvironmentAliases('development');
  assert.deepStrictEqual(developmentAliases, ['dev', 'development']);

  const stagingAliases = DeliveryContentService.getEnvironmentAliases('staging');
  assert.deepStrictEqual(stagingAliases, ['staging']);
});

test('Delivery API - Content resolution falls back to base language when no translation exists', () => {
  const mockEntry: any = {
    title: 'Hello World',
    publishedTitle: 'Hello World Published',
    baseLanguage: 'en',
    content: { headline: 'Default headline', body: 'Default body' },
    publishedContent: { headline: 'Published headline', body: 'Published body' },
    translations: {
      es: { headline: 'Titular en español' },
    },
    publishedTranslations: {
      es: { headline: 'Titular publicado en español' },
    },
    publishedAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-01T10:00:00Z'),
  };

  // Base language resolution
  const baseRes = DeliveryContentService.resolveEntryContent(mockEntry, 'en');
  assert.strictEqual(baseRes.title, 'Hello World Published');
  assert.strictEqual(baseRes.content.headline, 'Published headline');
  assert.strictEqual(baseRes.content.body, 'Published body');
  assert.strictEqual(baseRes.effectiveLocale, 'en');

  // Translation resolution with fallback on missing field
  const esRes = DeliveryContentService.resolveEntryContent(mockEntry, 'es');
  assert.strictEqual(esRes.content.headline, 'Titular publicado en español');
  assert.strictEqual(esRes.content.body, 'Published body', 'Missing translation field must fallback to base content');
  assert.strictEqual(esRes.effectiveLocale, 'es');

  // Non-existent translation completely falls back to base
  const frRes = DeliveryContentService.resolveEntryContent(mockEntry, 'fr');
  assert.strictEqual(frRes.content.headline, 'Published headline');
  assert.strictEqual(frRes.content.body, 'Published body');
  assert.strictEqual(frRes.effectiveLocale, 'fr');
});

test('Delivery API - Header-only Auth Middleware rejects query parameter keys with 401', async () => {
  const req: any = {
    query: { api_key: 'es_live_somekey123' },
    headers: {},
  };
  let responseStatus = 0;
  let responseBody: any = null;
  const res: any = {
    status(code: number) {
      responseStatus = code;
      return {
        json(body: any) {
          responseBody = body;
        },
      };
    },
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  await apiKeyAuthMiddleware(req, res, next);

  assert.strictEqual(responseStatus, 401);
  assert.strictEqual(responseBody?.error?.code, 'FORBIDDEN_QUERY_AUTH');
  assert.strictEqual(nextCalled, false, 'Next must not be called when query auth is attempted');
});

test('Delivery API - Auth Middleware rejects request when no key is provided', async () => {
  const req: any = {
    query: {},
    headers: {},
  };
  let responseStatus = 0;
  let responseBody: any = null;
  const res: any = {
    status(code: number) {
      responseStatus = code;
      return {
        json(body: any) {
          responseBody = body;
        },
      };
    },
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  await apiKeyAuthMiddleware(req, res, next);

  assert.strictEqual(responseStatus, 401);
  assert.strictEqual(responseBody?.error?.code, 'MISSING_API_KEY');
  assert.strictEqual(nextCalled, false);
});
