# Master Architecture & Flow Diagrams

This document collects architectural and data flow Mermaid diagrams modeling the runtime topology, polyglot storage relationships, and lifecycle mechanics of EasyStack Backend.

---

## 1. System Runtime Topology

```mermaid
flowchart TD
    Client[Web Client / Mobile App] -->|HTTP / REST| NGINX[Reverse Proxy / Ingress]
    NGINX --> Express[Express 5 Server: src/server.ts]

    subgraph ExpressPipeline[Express Middleware Pipeline]
        CORS[cors: Configured Origins]
        Parser[express.json & cookieParser]
        ReqCtx[requestContextMiddleware: AsyncLocalStorage]
        ReqLog[requestLogger: Winston]
        AuthGate[authenticate: JWT / Session Verify]
        RbacGate[authorize: Redis Auth Cache]
        BillGate[billingMiddleware: Quota & Plan Guard]
        Router[Domain Routes & Controllers]
        ErrHandler[errorHandlerMiddleware]

        CORS --> Parser --> ReqCtx --> ReqLog --> AuthGate --> RbacGate --> BillGate --> Router --> ErrHandler
    end

    Express --> ExpressPipeline
    Router --> Services[Domain Services: src/services/]

    subgraph DataTier[Polyglot Storage & Queue Infrastructure]
        MySQL[(MySQL 8 / Prisma)]
        Mongo[(MongoDB / Mongoose)]
        Redis[(Redis 7 / ioredis)]
        S3[(AWS S3 / MinIO)]
    end

    Services --> MySQL
    Services --> Mongo
    Services --> Redis
    Services --> S3

    subgraph BackgroundWorkers[BullMQ Standalone Workers: src/workers/]
        EmailW[Email Worker: Brevo / SMTP]
        StorageW[Storage Worker: Intent GC & S3 Reconciliation]
        TransW[Translation Worker: LLM Provider]
        CleanupW[Cleanup Worker: Project & Workspace Purge]
        ReleaseW[Release Worker: Scheduled Environment Deployment]
    end

    Redis <--> BackgroundWorkers
    BackgroundWorkers --> MySQL
    BackgroundWorkers --> Mongo
    BackgroundWorkers --> S3
```

---

## 2. Polyglot Entity-Relationship Architecture

```mermaid
erDiagram
    %% MySQL Relational Entities (Prisma)
    USER ||--o{ WORKSPACE_MEMBER : has
    USER ||--o{ SESSION : owns
    USER ||--o{ PROJECT_MEMBER : has
    WORKSPACE ||--o{ WORKSPACE_MEMBER : contains
    WORKSPACE ||--o{ PROJECT : contains
    WORKSPACE ||--|| SUBSCRIPTION : billed_under
    PROJECT ||--o{ PROJECT_MEMBER : contains
    PROJECT ||--o{ ENVIRONMENT : defines
    PROJECT ||--o{ PROJECT_LANGUAGE : configures
    UPLOAD_INTENT ||--|| STORAGE_ASSET : resolves_to

    %% Cross-Store Relationships (MySQL -> MongoDB)
    PROJECT ||--o{ MONGO_FEED_VERSION : "references via projectId"
    PROJECT ||--o{ MONGO_SCHEMA_BLUEPRINT : "references via projectId"
    ENVIRONMENT ||--o{ MONGO_FEED_VERSION : "tracks activeVersionId"

    %% MongoDB Document Models
    MONGO_FEED_VERSION ||--o{ MONGO_FEED_LOCALIZATION : embeds_or_links
    MONGO_FEED_VERSION ||--o{ MONGO_FEED_AUDIT_LOG : tracks
    MONGO_FEED_LOCALIZATION ||--o{ MONGO_FEED_COMMENT : contains_threads
    MONGO_SCHEMA_BLUEPRINT ||--o{ MONGO_SCHEMA_VERSION : snapshots
    MONGO_SCHEMA_BLUEPRINT ||--o{ MONGO_CONTENT_ENTRY : instantiates
```

---

## 3. Authentication & Token Rotation State Machine

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated

    Unauthenticated --> PendingVerification : POST /api/auth/register
    PendingVerification --> Authenticated : POST /api/auth/verify-email (Valid OTP)
    PendingVerification --> PendingVerification : POST /api/auth/resend-otp

    Unauthenticated --> Authenticated : POST /api/auth/login (Valid Password)
    Unauthenticated --> Authenticated : POST /api/auth/providers/google (Valid ID Token)

    state Authenticated {
        [*] --> ActiveSession
        ActiveSession --> TokenExpired : Access Token TTL (15m)
        TokenExpired --> ActiveSession : POST /api/auth/refresh (Valid Refresh Token Cookie)
        TokenExpired --> SessionRevoked : Refresh Token Expired or Revoked (7d)
    }

    Authenticated --> Unauthenticated : POST /api/auth/logout (Revoke Session)
    SessionRevoked --> Unauthenticated
```

---

## 4. Authorization Resolution Flow

```mermaid
flowchart TD
    Req([Protected Request]) --> CheckAuth{Is Authenticated?}
    CheckAuth -- No --> Ret401[401 Unauthorized]
    CheckAuth -- Yes --> ReadCache{Read Redis Cache:<br/>authorization:v1:userId}
    
    ReadCache -- Hit --> EvalNode[Evaluate node.permissions for scope and scopeId]
    ReadCache -- Miss --> BuildCache[Fetch Workspace & Project Memberships]
    
    BuildCache --> Synth[Synthesize Implicit Inheritance:<br/>WORKSPACE_OWNER -> PROJECT_OWNER<br/>WORKSPACE_ADMIN -> PROJECT_ADMIN]
    Synth --> Flatten[Flatten Permissions via PermissionResolver]
    Flatten --> SaveRedis[Save to Redis with TTL]
    SaveRedis --> EvalNode

    EvalNode -- Has Permission --> Proceed[next: Execute Controller]
    EvalNode -- Missing Permission --> Ret403[403 Forbidden]
```

---

## 5. Intent-Based Object Storage Upload Flow

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Web Browser / Client
    participant API as EasyStack API (Storage Controller)
    participant StorageSvc as StorageService (Domain)
    participant DB as MySQL (Prisma)
    participant S3 as AWS S3 / MinIO
    participant Worker as BullMQ Storage Worker

    Browser->>API: POST /api/storage/upload-intents (target, size, mimeType)
    API->>StorageSvc: createUploadIntent(input)
    StorageSvc->>DB: INSERT UploadIntent (status: PENDING)
    StorageSvc->>S3: Generate Presigned POST / PUT URL
    StorageSvc-->>API: { uploadId, presignedUrl, fields }
    API-->>Browser: 201 Created (Upload Instructions)

    Browser->>S3: Direct POST file payload using Presigned URL
    S3-->>Browser: 204 No Content (Upload Success)

    Browser->>API: POST /api/storage/upload-intents/:uploadId/complete
    API->>StorageSvc: completeUpload(uploadId)
    StorageSvc->>S3: HEAD Object (verify exists, size, mimeType)
    StorageSvc->>DB: UPDATE UploadIntent (status: COMPLETED)
    StorageSvc->>DB: UPSERT StorageAsset (connect targetKey & S3 URL)
    StorageSvc-->>API: CompletedStorageAsset
    API-->>Browser: 200 OK

    Note over DB,Worker: Expired intents left in PENDING
    Worker->>DB: Hourly Reconciliation Job
    Worker->>S3: Delete uncompleted or orphaned S3 keys
    Worker->>DB: Mark expired UploadIntent as CLEANED
```
