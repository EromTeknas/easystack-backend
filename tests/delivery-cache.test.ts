import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryCacheService } from '../src/delivery/services/delivery-cache.service';
import { redisClient } from '../src/db/redis';

after(async () => {
  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
});

test('DeliveryCacheService - Canonical environment name normalizes correctly', () => {
  assert.strictEqual(DeliveryCacheService.canonicalEnv('live'), 'live');
  assert.strictEqual(DeliveryCacheService.canonicalEnv('production'), 'live');
  assert.strictEqual(DeliveryCacheService.canonicalEnv('dev'), 'dev');
  assert.strictEqual(DeliveryCacheService.canonicalEnv('development'), 'dev');
  assert.strictEqual(DeliveryCacheService.canonicalEnv('staging'), 'staging');
  assert.strictEqual(DeliveryCacheService.canonicalEnv('  Live  '), 'live');
});

test('DeliveryCacheService - Version tracking starts at 1 and increments atomically', async () => {
  const testProjectId = 99999;
  const testEnv = 'testenv';
  const testSlug = 'cache-test-blueprint';

  const versionKey = DeliveryCacheService.getVersionKey(testProjectId, testEnv, testSlug);
  await redisClient.del(versionKey);

  // Initial version defaults to 1
  const initialVer = await DeliveryCacheService.getBlueprintVersion(testProjectId, testEnv, testSlug);
  assert.strictEqual(initialVer, 1, 'Initial blueprint version must default to 1');

  // Increment version
  const nextVer = await DeliveryCacheService.incrementBlueprintVersion(testProjectId, testEnv, testSlug);
  assert.strictEqual(nextVer, 2, 'Incremented version must be 2');

  const fetchedVer = await DeliveryCacheService.getBlueprintVersion(testProjectId, testEnv, testSlug);
  assert.strictEqual(fetchedVer, 2, 'Subsequent get must reflect incremented version');

  // Clean up
  await redisClient.del(versionKey);
});

test('DeliveryCacheService - ETag generation is deterministic and formatted as weak ETag', () => {
  const payload1 = { title: 'Test', count: 42, tags: ['a', 'b'] };
  const payload2 = { title: 'Test', count: 42, tags: ['a', 'b'] };
  const payload3 = { title: 'Other', count: 99 };

  const etag1 = DeliveryCacheService.generateETag(payload1);
  const etag2 = DeliveryCacheService.generateETag(payload2);
  const etag3 = DeliveryCacheService.generateETag(payload3);

  assert.strictEqual(etag1, etag2, 'Identical payloads must produce identical ETags');
  assert.notStrictEqual(etag1, etag3, 'Different payloads must produce different ETags');
  assert.ok(etag1.startsWith('W/"') && etag1.endsWith('"'), 'ETag must be formatted as weak ETag W/"..."');
});

test('DeliveryCacheService - Cache key generation normalizes query parameters deterministically', () => {
  const key1 = DeliveryCacheService.buildCacheKey(
    1,
    'live',
    'blog-posts',
    2,
    'collection',
    'root',
    { page: 1, limit: 10, search: 'travel' }
  );

  // Different query parameter order must generate identical cache key
  const key2 = DeliveryCacheService.buildCacheKey(
    1,
    'live',
    'blog-posts',
    2,
    'collection',
    'root',
    { search: 'travel', limit: 10, page: 1 }
  );

  assert.strictEqual(key1, key2, 'Cache key must be order-insensitive for query parameters');
  assert.ok(key1.includes(':v2:'), 'Cache key must embed version number :v2:');
  assert.ok(key1.includes('blog-posts'), 'Cache key must embed blueprint slug');

  // Incrementing version creates distinct cache key
  const keyV3 = DeliveryCacheService.buildCacheKey(
    1,
    'live',
    'blog-posts',
    3,
    'collection',
    'root',
    { page: 1, limit: 10, search: 'travel' }
  );
  assert.notStrictEqual(key1, keyV3, 'Incremented version must create a distinct cache key');
});

test('DeliveryCacheService - Writes and reads cached responses from Redis', async () => {
  const cacheKey = 'cdn:cache:test:sample-key-123';
  const samplePayload = { data: { message: 'hello world' }, meta: { timestamp: '2026-11-08' } };
  const etag = 'W/"mock-etag-123"';
  const version = 1;

  // Ensure clean slate
  await redisClient.del(cacheKey);

  const initial = await DeliveryCacheService.getCachedResponse(cacheKey);
  assert.strictEqual(initial, null, 'Cache miss must return null');

  // Store in cache
  await DeliveryCacheService.setCachedResponse(cacheKey, samplePayload, etag, version, 60);

  const cached = await DeliveryCacheService.getCachedResponse(cacheKey);
  assert.ok(cached, 'Cached response must exist');
  assert.deepStrictEqual(cached.data, samplePayload);
  assert.strictEqual(cached.etag, etag);
  assert.strictEqual(cached.version, version);

  // Clean up
  await redisClient.del(cacheKey);
});

test('Delivery API - Conditional 304 Not Modified behavior on matching ETag', async () => {
  const { DeliveryContentController } = await import('../src/delivery/controllers/delivery-content.controller');
  const { DeliveryContentService } = await import('../src/delivery/services/delivery-content.service');

  const testNonce = Date.now();
  const projectId = 800000 + (testNonce % 100000);
  const envName = 'live';
  const blueprintSlug = `articles-${testNonce}`;

  const versionKey = DeliveryCacheService.getVersionKey(projectId, envName, blueprintSlug);
  await redisClient.del(versionKey);

  // Mock DeliveryContentService.getBlueprintContent
  const originalGetBlueprintContent = DeliveryContentService.getBlueprintContent;
  let serviceCallCount = 0;
  DeliveryContentService.getBlueprintContent = async () => {
    serviceCallCount++;
    return {
      data: [{ id: '1', title: 'Cached Article', content: { body: 'Hello World' } }],
      meta: {
        project: 'test-project',
        environment: envName,
        blueprint: blueprintSlug,
        type: 'collection' as const,
        locale: 'en',
        timestamp: new Date().toISOString(),
      },
    };
  };

  try {
    const mockContext = {
      projectId,
      environmentId: 1,
      environmentName: envName,
      environmentDisplayName: 'Live',
      projectName: 'Test Project',
      apiKeyId: 10,
      apiKeyName: 'Test Key',
      keyPrefix: 'es_live_test...',
      rateLimitPerMinute: 600,
      allowedOrigins: null,
    };

    // Helper to mock express req/res
    const makeRequest = async (headers: Record<string, string> = {}) => {
      let statusCode = 200;
      const resHeaders: Record<string, string> = {};
      let resBody: any = null;

      const req: any = {
        params: { blueprintSlug },
        query: {},
        headers,
        deliveryContext: mockContext,
      };

      const res: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        setHeader(name: string, val: string) {
          resHeaders[name.toLowerCase()] = val;
        },
        json(body: any) {
          resBody = body;
        },
        end() {},
      };

      await DeliveryContentController.getContent(req, res, () => {});
      return { statusCode, resHeaders, resBody };
    };

    // 1. First Call: Cache MISS
    const firstCall = await makeRequest();
    assert.strictEqual(firstCall.statusCode, 200);
    assert.strictEqual(firstCall.resHeaders['x-cache'], 'MISS');
    assert.strictEqual(firstCall.resHeaders['x-content-version'], '1');
    assert.ok(firstCall.resHeaders['etag'], 'ETag header must be present');
    assert.strictEqual(serviceCallCount, 1, 'Service must be called on cache MISS');

    const generatedETag = firstCall.resHeaders['etag'];

    // 2. Second Call: Cache HIT (same request)
    const secondCall = await makeRequest();
    assert.strictEqual(secondCall.statusCode, 200);
    assert.strictEqual(secondCall.resHeaders['x-cache'], 'HIT');
    assert.strictEqual(secondCall.resHeaders['x-content-version'], '1');
    assert.strictEqual(secondCall.resHeaders['etag'], generatedETag);
    assert.strictEqual(serviceCallCount, 1, 'Service must NOT be called on cache HIT');

    // 3. Third Call: Conditional Request with matching If-None-Match -> 304 Not Modified
    const thirdCall = await makeRequest({ 'if-none-match': generatedETag });
    assert.strictEqual(thirdCall.statusCode, 304, 'Matching If-None-Match must return 304 Not Modified');
    assert.strictEqual(thirdCall.resHeaders['x-cache'], 'HIT');
    assert.strictEqual(thirdCall.resBody, null, '304 responses must send zero body payload');

    // 4. Invalidation: Increment Blueprint Version to 2
    const nextVer = await DeliveryCacheService.incrementBlueprintVersion(projectId, envName, blueprintSlug);
    assert.strictEqual(nextVer, 2);

    // 5. Fourth Call after invalidation: must be Cache MISS with v2
    const fourthCall = await makeRequest();
    assert.strictEqual(fourthCall.statusCode, 200);
    assert.strictEqual(fourthCall.resHeaders['x-cache'], 'MISS', 'Must be MISS after version invalidation');
    assert.strictEqual(fourthCall.resHeaders['x-content-version'], '2');
    assert.strictEqual(serviceCallCount, 2, 'Service must be invoked fresh after version invalidation');
  } finally {
    // Restore original service method and clean up
    DeliveryContentService.getBlueprintContent = originalGetBlueprintContent;
    await redisClient.del(versionKey);
  }
});

