import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryRateLimiterService } from '../src/delivery/services/delivery-rate-limiter.service';
import { deliveryRateLimitMiddleware } from '../src/delivery/middlewares/rate-limit.middleware';
import { isOriginAllowed } from '../src/delivery/middlewares/api-key-auth.middleware';
import { redisClient } from '../src/db/redis';

after(async () => {
  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
});

test('DeliveryRateLimiterService - allows requests within window and computes remaining accurately', async () => {
  const apiKeyId = 77701;
  const rateLimitKey = DeliveryRateLimiterService.getRateLimitKey(apiKeyId);
  await redisClient.del(rateLimitKey);

  const limit = 5;

  // First 5 requests should be allowed
  for (let i = 0; i < limit; i++) {
    const res = await DeliveryRateLimiterService.checkLimit(apiKeyId, limit, 60000);
    assert.strictEqual(res.allowed, true, `Request ${i + 1} must be allowed`);
    assert.strictEqual(res.remaining, limit - 1 - i, `Remaining must be ${limit - 1 - i}`);
    assert.strictEqual(res.limit, limit);
  }

  // 6th request must be rejected (rate limit exceeded)
  const rejected = await DeliveryRateLimiterService.checkLimit(apiKeyId, limit, 60000);
  assert.strictEqual(rejected.allowed, false, '6th request must be blocked');
  assert.strictEqual(rejected.remaining, 0);
  assert.ok(rejected.retryAfterSeconds > 0, 'Retry-After must be positive');

  // Clean up
  await redisClient.del(rateLimitKey);
});

test('deliveryRateLimitMiddleware - injects rate limit headers and responds 429 when exhausted', async () => {
  const apiKeyId = 77702;
  const rateLimitKey = DeliveryRateLimiterService.getRateLimitKey(apiKeyId);
  await redisClient.del(rateLimitKey);

  const limit = 2;
  const mockContext: any = {
    apiKeyId,
    rateLimitPerMinute: limit,
  };

  const makeCall = async () => {
    let statusCode = 200;
    const headers: Record<string, string> = {};
    let body: any = null;
    let nextCalled = false;

    const req: any = {
      deliveryContext: mockContext,
      requestId: 'req-rate-test-1',
    };

    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      setHeader(k: string, v: string) {
        headers[k.toLowerCase()] = v;
      },
      json(b: any) {
        body = b;
      },
    };

    await deliveryRateLimitMiddleware(req, res, () => {
      nextCalled = true;
    });

    return { statusCode, headers, body, nextCalled };
  };

  // 1st request
  const req1 = await makeCall();
  assert.strictEqual(req1.nextCalled, true);
  assert.strictEqual(req1.headers['x-ratelimit-limit'], '2');
  assert.strictEqual(req1.headers['x-ratelimit-remaining'], '1');

  // 2nd request
  const req2 = await makeCall();
  assert.strictEqual(req2.nextCalled, true);
  assert.strictEqual(req2.headers['x-ratelimit-remaining'], '0');

  // 3rd request - blocked!
  const req3 = await makeCall();
  assert.strictEqual(req3.nextCalled, false, 'Next must not be called when limit is exceeded');
  assert.strictEqual(req3.statusCode, 429, 'Must return 429 Too Many Requests');
  assert.ok(req3.headers['retry-after'], 'Retry-After header must be set');
  assert.strictEqual(req3.body?.error?.code, 'RATE_LIMIT_EXCEEDED');

  // Clean up
  await redisClient.del(rateLimitKey);
});

test('Delivery API - isOriginAllowed correctly validates exact, wildcard, and port patterns', () => {
  // Universal wildcard
  assert.strictEqual(isOriginAllowed('https://anything.com', ['*']), true);

  // Exact matches
  const allowed1 = ['https://mywebsite.com', 'https://admin.mywebsite.com'];
  assert.strictEqual(isOriginAllowed('https://mywebsite.com', allowed1), true);
  assert.strictEqual(isOriginAllowed('https://other.com', allowed1), false);

  // Wildcard subdomains
  const allowedWildcard = ['https://*.mywebsite.com'];
  assert.strictEqual(isOriginAllowed('https://blog.mywebsite.com', allowedWildcard), true);
  assert.strictEqual(isOriginAllowed('https://api.staging.mywebsite.com', allowedWildcard), true);
  assert.strictEqual(isOriginAllowed('https://evilwebsite.com', allowedWildcard), false);

  // Port wildcards for local dev
  const allowedPorts = ['http://localhost:*'];
  assert.strictEqual(isOriginAllowed('http://localhost:3000', allowedPorts), true);
  assert.strictEqual(isOriginAllowed('http://localhost:8080', allowedPorts), true);
  assert.strictEqual(isOriginAllowed('http://remotehost:3000', allowedPorts), false);
});
