# Content & Schemas Module

## 1. Purpose & Responsibilities

The **Content & Schemas Module** acts as EasyStack's flexible headless CMS engine. It allows developers to define dynamic **Schema Blueprints** (content types with custom fields, types, and validation rules) and allows content authors to create, edit, version, and publish **Content Entries** conforming to those blueprints.

### Core Responsibilities
- Create and manage Schema Blueprints with field definitions and type validation.
- Maintain versioned blueprint snapshots across environments (`SchemaBlueprintVersion`).
- Author, validate, and store Content Entries (`ContentEntry`).
- Support draft versus published states and revision histories.
- Verify slug uniqueness per schema and project.
- Synchronize content across deployment environments (`syncEnvironmentData`).
- Record chronological content change history in `ContentAuditLog`.

---

## 2. File Responsibility Map

```text
src/
├── routes/
│   ├── schemas/
│   │   ├── schema-blueprint.routes.ts      # Mounted at /api/projects/:projectId/schemas
│   │   └── schema-blueprint.controller.ts # Blueprint CRUD, slug check, deploy to environment
│   └── content/
│       ├── content-entry.routes.ts         # Mounted at /api/projects/:projectId/content
│       └── content-entry.controller.ts    # Content CRUD, publish, environment sync, audit
│
├── services/
│   ├── schema-blueprint.service.ts         # Schema creation, field validation, versioning
│   ├── content-entry.service.ts            # Entry drafting, schema conformance, publishing
│   └── content-audit.service.ts            # Content audit trail logger
│
├── repositories/
│   ├── schema-blueprint.repository.ts      # Data access layer for blueprints
│   └── content-entry.repository.ts         # Data access layer for content entries
│
└── models/
    ├── schema-blueprint.model.ts           # Mongoose model: SchemaBlueprint
    ├── schema-blueprint-version.model.ts   # Mongoose model: SchemaBlueprintVersion (snapshot)
    ├── content-entry.model.ts              # Mongoose model: ContentEntry (draft/published data)
    └── content-audit-log.model.ts          # Mongoose model: ContentAuditLog
```

---

## 3. Schemas vs Content Relationship

```mermaid
graph TD
    Project[(MySQL Project: projectId)] --> Blueprint[MongoDB: SchemaBlueprint]
    Blueprint -->|Defines Fields & Validations| BlueprintVersion[SchemaBlueprintVersion: Snapshots per Env]
    BlueprintVersion -->|Validates Structure of| ContentEntry[MongoDB: ContentEntry]
    
    subgraph ContentEntryStructure[ContentEntry Documents]
        direction TB
        Draft[Draft Content: Active Working Copy]
        Published[Published Content: Live Production Copy]
        Audit[ContentAuditLog: Author & Diff]
        Draft -->|Publish Action| Published
        Draft --> Audit
    end
```

---

## 4. Key Endpoints & Workflow Capabilities

### Schema Endpoints (`/api/projects/:projectId/schemas`)
- `GET /`: Lists all schema blueprints in the project.
- `GET /check-slug?slug=posts`: Verifies slug availability.
- `POST /`: Creates a new schema blueprint with field definitions.
- `PUT /:schemaId`: Updates a blueprint definition in development. Blueprints in non-development environments cannot be updated directly (`BadRequestError`).
- `POST /:schemaId/deploy`: Deploys the blueprint schema to a designated environment.

### Environment Rank System & Blueprint Read-Only Enforcement
- Projects initialize with 2 default environments ordered by rank: `development` (rank 10, isEditable: true) and `production`/Live (rank 20, isEditable: false).
- Creating additional environments requires plan quota availability (`environments_per_project`).
- Live environment blueprints are strictly read-only snapshots (`SchemaBlueprintVersion`). Users can view blueprints in Live mode, but editing is disabled and schema updates must be deployed through Releases.

### Content Endpoints (`/api/projects/:projectId/content/:schemaSlug`)
- `GET /`: Paginated list of content entries under this schema.
- `GET /check-slug`: Verifies entry slug availability.
- `POST /`: Creates a new content entry draft.
- `PUT /:entryId`: Updates the draft content.
- `POST /:entryId/publish`: Promotes the draft content to the published state.
- `POST /:entryId/translate`: Enqueues automated translation jobs for localized fields.
- `POST /sync-environments`: Syncs content data between environments (e.g., development to staging).
- `GET /:entryId/audit-logs`: Retrieves audit logs for the content entry.

---

## 5. Background AI Translation Processing
- Translation requests are dispatched via BullMQ to the `ai-translation` queue.
- BullMQ Redis connections require `maxRetriesPerRequest: null` (configured in `src/config/redis.ts`) to allow blocking list operations (`BRPOPLPUSH`/`BLMOVE`) without triggering connection timeout errors.
- Workers asynchronously process pending translations per language and persist completed entries with status tracking (`queued`, `translating`, `ready`, `failed`).

