# Content Delivery API (Public API) Module

## 1. Overview & Architecture

The **Content Delivery API** serves live, published headless CMS content directly to client applications (websites, mobile apps, single-page applications, and external integrations). It is implemented as an independent standalone HTTP process (`src/delivery.server.ts`) listening on port `3005` (configurable via `DELIVERY_PORT`), completely decoupled from administrative CMS routes and business logic.

```mermaid
graph LR
    Client[Client Applications: Web / Mobile / Static Sites] -->|x-api-key: es_live_...| DeliveryServer[Delivery API Process: Port 3005]
    
    subgraph DeliveryCore[Delivery Engine src/delivery/]
        DeliveryServer --> AuthMiddleware[API Key Header Auth]
        AuthMiddleware --> RedisCache[(Redis: apikey:auth:{hash})]
        AuthMiddleware --> DeliveryContentService[Delivery Content Service]
        DeliveryContentService --> PublishedRepo[PublishedContentRepository]
    end

    PublishedRepo -->|Read-only Queries| Mongo[(MongoDB: ContentEntry & Blueprints)]
    CMS[CMS Admin API: Port 3000/3002] -->|Admin API Key Management| MySQL[(MySQL: api_keys)]
```

### Core Security & Architectural Invariants
1. **Header-Only Authentication**: API keys must **NEVER** be supplied via URL query parameters (`?api_key=`). Attempts are immediately blocked with `401 Unauthorized` (`FORBIDDEN_QUERY_AUTH`) to prevent token leakage in proxy logs and browser history. Authentication is accepted strictly via `x-api-key: es_...` or `Authorization: Bearer es_...`.
2. **Authoritative Environment Binding**: The API key strictly determines the project and environment. Public clients cannot forge or switch environments via query parameters or path variables.
3. **Published Content Only**: The Delivery API exclusively returns published entries (`status: 'published'`) with immutable published snapshots (`publishedContent`, `publishedTitle`, `publishedTranslations`). Draft or staging content is never exposed.
4. **Locale Merging with Fallback**: Content requested with `?locale=xx` merges translated fields over the base language content, falling back to base language values whenever translations are absent.
5. **Instant Invalidation**: API key revocation instantly purges the corresponding Redis authentication cache key (`apikey:auth:{keyHash}`).

---

## 2. File Responsibility Map

```text
src/
├── delivery.server.ts                     # Standalone HTTP delivery server entrypoint (port 3005)
├── delivery/
│   ├── types/
│   │   └── delivery.types.ts              # Delivery context, meta, envelopes, query parameters
│   ├── repositories/
│   │   ├── api-key.repository.ts          # MySQL Prisma queries for ApiKey CRUD & lastUsedAt touch
│   │   └── published-content.repository.ts# Read-only MongoDB queries for published entries & blueprints
│   ├── services/
│   │   ├── api-key-auth.service.ts        # Key generation (SHA-256), verification, Redis caching
│   │   ├── delivery-cache.service.ts      # Version tracking (cdn:version), ETag, conditional 304, Redis cache
│   │   └── delivery-content.service.ts    # Content resolution, environment aliasing, locale fallback
│   ├── middlewares/
│   │   ├── request-id.middleware.ts       # Assigns and traces X-Request-ID
│   │   ├── api-key-auth.middleware.ts     # Header auth, query rejection, origin enforcement
│   │   └── delivery-error.middleware.ts   # Uniform JSON error formatting (DeliveryErrorEnvelope)
│   ├── controllers/
│   │   └── delivery-content.controller.ts # Handlers for connection test, singleton, and collection
│   └── routes/
│       ├── test.routes.ts                 # GET /v1/test
│       ├── content.routes.ts              # GET /v1/content/:blueprintSlug (and /:entrySlug)
│       └── index.ts                       # Delivery router protected by apiKeyAuthMiddleware
│
└── routes/
    └── api-keys/
        ├── api-keys.controller.ts         # CMS API key management (list, create, revoke)
        └── api-keys.routes.ts             # Mounted at /api/projects/:projectId/api-keys
```

---

## 3. Public Endpoints (Port 3005)

All endpoints below are prefixed with `/v1` and require header authentication (`x-api-key` or `Authorization: Bearer <key>`).

### 1. Connection Test
- **Method**: `GET`
- **Path**: `/v1/test`
- **Description**: Verifies API key validity and returns bound project and environment metadata.
- **Response**:
```json
{
  "status": "connected",
  "project": {
    "id": 1,
    "name": "Acme Store"
  },
  "environment": {
    "id": 2,
    "name": "live",
    "displayName": "Live"
  },
  "key": {
    "id": 5,
    "name": "Production Website Key",
    "prefix": "es_live_a1b2c3d4..."
  },
  "timestamp": "2026-11-08T12:00:00.000Z"
}
```

### 2. Fetch Singleton Content or Collection List
- **Method**: `GET`
- **Path**: `/v1/content/:blueprintSlug`
- **Query Parameters**:
  - `page`: Page number for collections (default: `1`).
  - `limit`: Items per page for collections (default: `20`, max: `100`).
  - `locale`: ISO language code (e.g. `es`, `fr`). Falls back to base language.
  - `search`: Keyword search matching entry title or slug.
  - `sort`: Field sort order (e.g. `-publishedAt`, `title`, `createdAt`).

### 3. Fetch Single Collection Entry
- **Method**: `GET`
- **Path**: `/v1/content/:blueprintSlug/:entrySlug`
- **Query Parameters**:
  - `locale`: ISO language code for localized content translation.

---

## 4. CMS API Key Management Endpoints (Port 3000/3002)

Mounted under `/api/projects/:projectId/api-keys` in the CMS admin API.

| Method | Endpoint | RBAC Permission | Description |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/api-keys` | `api_key:read` | List all API keys for the project (key hashes excluded) |
| `POST` | `/api/projects/:projectId/api-keys` | `api_key:create` | Generate a new API key. Returns raw key once. |
| `DELETE` | `/api/projects/:projectId/api-keys/:apiKeyId` | `api_key:revoke` | Revoke an API key and evict its Redis cache entry |

---

## 5. Version-Based Redis Caching & Invalidation Architecture

### Overview
To achieve sub-millisecond response times without blocking Redis instances with expensive wildcard scans (`KEYS` or `SCAN`), EasyStack uses **Version-Based Namespaces**:

1. **Version Tracking Key**:
   - `cdn:version:{projectId}:{environmentName}:{blueprintSlug}` (e.g. `cdn:version:1:live:blog-posts`).
   - Baseline default value: `1`.
2. **Content Cache Key**:
   - `cdn:cache:{projectId}:{environmentName}:{blueprintSlug}:v{version}:{scope}:{identifier}:{locale}:{queryHash}`
   - Where query parameters (`page`, `limit`, `sort`, `search`) are normalized deterministically into an MD5 hash.
3. **Atomic Invalidation**:
   - Publishing an entry, deleting a published entry, or deploying a release invokes:
     ```typescript
     await DeliveryCacheService.incrementBlueprintVersion(projectId, environment, blueprintSlug);
     ```
   - This increments the version counter in Redis. Future requests immediately resolve to `:v{newVersion}:`, orphaning all old entries with zero blocking scans.
   - Old entries automatically expire and are cleaned by Redis via their 1-hour safety TTL.

### HTTP Conditional Caching (ETag & 304 Not Modified)
- Every delivery response is stamped with:
  - `ETag: W/"<md5-hash-of-payload>"`
  - `X-Cache: HIT` or `X-Cache: MISS`
  - `X-Content-Version: <version>`
  - `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60`
- If an incoming request includes `If-None-Match` matching the current ETag, the server immediately returns `304 Not Modified` with zero response payload, eliminating downstream bandwidth and JSON deserialization overhead.
