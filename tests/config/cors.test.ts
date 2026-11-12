import { describe, test } from "node:test";
import assert from "node:assert";
import { isOriginAllowed } from "../../src/config/cors";

describe("CORS Origin Validation", () => {
  test("allows exact matches from configured origins", () => {
    assert.strictEqual(isOriginAllowed("http://localhost:3000"), true);
    assert.strictEqual(isOriginAllowed("http://localhost:3001"), true);
    assert.strictEqual(isOriginAllowed("http://localhost:3002"), true);
  });

  test("allows subdomains of localhost on configured ports", () => {
    assert.strictEqual(isOriginAllowed("http://wanderlust-portal.localhost:3000"), true);
    assert.strictEqual(isOriginAllowed("http://client-portal.localhost:3000"), true);
    assert.strictEqual(isOriginAllowed("http://nested.subdomain.localhost:3000"), true);
  });

  test("rejects origins with wrong port", () => {
    assert.strictEqual(isOriginAllowed("http://wanderlust-portal.localhost:4000"), false);
    assert.strictEqual(isOriginAllowed("http://localhost:4000"), false);
  });

  test("rejects deceptive hostnames", () => {
    assert.strictEqual(isOriginAllowed("http://notlocalhost:3000"), false);
    assert.strictEqual(isOriginAllowed("http://fake-localhost:3000"), false);
    assert.strictEqual(isOriginAllowed("http://evil.com:3000"), false);
  });

  test("allows empty or omitted origin (server-to-server / curl)", () => {
    assert.strictEqual(isOriginAllowed(""), true);
  });
});
