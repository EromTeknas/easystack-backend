# Feed Localization Pipeline Workflow

## 1. Overview & Triggers

This workflow traces how structured JSON feeds are authored, validated against schema rules, marked stale when base content changes, and asynchronously translated into multiple target languages using AI workers.

### Triggers
- **Update Draft Content**: `PUT /api/projects/:projectId/feeds/:feedId/draft`
- **Trigger AI Auto-Translation**: `POST /api/projects/:projectId/feeds/:feedId/auto-translate`
- **Save Manual Translation**: `PUT /api/projects/:projectId/feeds/:feedId/translations/:lang`
- **Mark Stale as Correct**: `POST /api/projects/:projectId/feeds/:feedId/translations/:lang/mark-correct`

---

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Editor as Content Editor
    participant API as EasyStack API (Feed Controller)
    participant FeedSvc as FeedService
    participant Validator as JsonValidationService
    participant Mongo as MongoDB (Mongoose)
    participant BullMQ as BullMQ (translation queue)
    participant Worker as Translation Worker
    participant LLM as LLM Service (Gemini)

    %% Update Draft Content
    Editor->>API: PUT /feeds/:id/draft (jsonContent, selectedKeys)
    Note over API: Gated by authenticate & authorize(FEED.UPDATE)
    API->>FeedSvc: updateDraftBaseContent()
    FeedSvc->>Validator: validate(jsonContent, selectedKeys)
    Validator-->>FeedSvc: Schema Valid
    FeedSvc->>Mongo: UPDATE FeedVersion (baseContent, selectedKeys)
    FeedSvc->>Mongo: Mirror to base FeedLocalization
    FeedSvc->>Mongo: UPDATE other FeedLocalization SET status = 'STALE'
    FeedSvc->>Mongo: INSERT FeedAuditLog (action: UPDATED_BASE)
    API-->>Editor: 200 OK (Draft Saved)

    %% Trigger Auto-Translate
    Editor->>API: POST /feeds/:id/auto-translate (targetLanguages: ['es', 'fr'])
    API->>FeedSvc: triggerAutoTranslate()
    FeedSvc->>Mongo: UPDATE FeedLocalization SET status = 'PENDING'
    FeedSvc->>BullMQ: Enqueue Translation Job
    API-->>Editor: 202 Accepted (Translation In Progress)

    %% Background Processing
    BullMQ->>Worker: Dequeue Translation Job
    Worker->>Worker: Extract targeted text via selectedKeys
    Worker->>LLM: Translate payload to target language
    LLM-->>Worker: Translated JSON
    Worker->>Mongo: UPDATE FeedLocalization (localizedContent, status: 'COMPLETED')
    Worker->>Mongo: INSERT FeedAuditLog (action: GENERATED_TRANSLATION)
```

---

## 3. Step-by-Step Execution Trace

### Phase 1: Authoring & Structural Validation
1. **Environment Check**: [`FeedService`](file:///home/eteknas/Projects/easystack-backend/src/services/feed.service.ts) verifies the target environment is editable (`targetEnv.isEditable === true`). Editing in non-editable environments throws `400 Bad Request`.
2. **Schema & JSON Validation**:
   - If the feed is linked to a Schema Blueprint, [`FeedSchemaValidationService`](file:///home/eteknas/Projects/easystack-backend/src/services/feed-schema-validation.service.ts) validates content types and required fields.
   - Otherwise, [`JsonValidationService`](file:///home/eteknas/Projects/easystack-backend/src/services/json-validation.service.ts) verifies max depth (<=10), array homogeneity, and wildcard path syntax.
3. **Draft Save & Stale Propagation**:
   - The JSON tree is saved into `FeedVersion.baseContent`.
   - The base language `FeedLocalization` is automatically updated to match.
   - All other existing translations are marked `status: 'STALE'` to warn frontend consumers that base text changes may have invalidated current translations.
   - An entry is appended to `FeedAuditLog` (`action: UPDATED_BASE`).

### Phase 2: AI Auto-Translation Pipeline
1. **Job Dispatch**: When auto-translation is invoked, `FeedLocalization` records are updated to `PENDING` and a batch job is enqueued in the `translation` BullMQ queue.
2. **Target Extraction**: The translation worker reads `FeedVersion.selectedKeys` and isolates only the string fields marked for translation using the `*` wildcard matcher.
3. **LLM Translation**: The worker formats a strict schema-preserving prompt for the LLM provider (`Gemini`).
4. **Completion & Audit**:
   - The LLM's response is validated for JSON shape preservation.
   - The translated content is written to `FeedLocalization.localizedContent` and status set to `COMPLETED`.
   - An audit event (`action: GENERATED_TRANSLATION`) is logged.
   - The aggregate feed status is recomputed.
