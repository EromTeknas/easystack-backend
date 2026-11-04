# Release Deployment Pipeline Workflow

## 1. Overview & Triggers

This workflow traces the promotion of feeds and schemas from editable development environments to read-only target environments (staging, production). It covers diff analysis, SemVer version suggestion, release creation with frozen snapshots, governance approval, scheduled or immediate deployment, and rollback.

### Triggers
- **Diff Inspection**: `GET /api/projects/:projectId/releases/diff`
- **SemVer Suggestion**: `GET /api/projects/:projectId/releases/suggest-version`
- **Create Release Draft**: `POST /api/projects/:projectId/releases`
- **Request Approval**: `POST /api/projects/:projectId/releases/:releaseId/request-approval`
- **Approve Release**: `POST /api/projects/:projectId/releases/:releaseId/approve`
- **Immediate Execution**: `POST /api/projects/:projectId/releases/:releaseId/execute`
- **Schedule Deployment**: `POST /api/projects/:projectId/releases/:releaseId/schedule`
- **Rollback Release**: `POST /api/projects/:projectId/releases/:releaseId/rollback`

---

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / Release Mgr
    actor Admin as Project Admin
    participant API as Release Controller
    participant Svc as ReleaseService
    participant DB as MySQL (Prisma)
    participant BullMQ as BullMQ (releaseQueue)
    participant Worker as Release Worker

    %% Diff & Create
    Dev->>API: GET /diff?sourceEnvId=1&targetEnvId=2
    API->>Svc: getEnvironmentDiff()
    Svc-->>API: Key-level diff (added, updated, deleted)
    Dev->>API: POST / (name, version, targetEnvId)
    API->>Svc: createRelease()
    Svc->>DB: Snapshot active FeedVersions & Schemas
    Svc->>DB: INSERT Release (status: DRAFT)
    API-->>Dev: 201 Created (Release Draft)

    %% Governance Approval
    Dev->>API: POST /:id/request-approval
    Admin->>API: POST /:id/approve
    Note over API: Gated by authorize(RELEASE.APPROVE)
    API->>Svc: approveRelease()
    Svc->>DB: UPDATE Release SET status = 'APPROVED'
    API-->>Admin: 200 OK

    %% Deployment Execution
    alt Immediate Deployment
        Admin->>API: POST /:id/execute
        API->>Svc: executeRelease()
        Svc->>DB: Transaction: UPDATE EnvironmentState.activeVersionId to Snapshot IDs
        Svc->>DB: UPDATE Release SET status = 'COMPLETED'
        API-->>Admin: 200 OK (Deployed)
    else Scheduled Deployment
        Admin->>API: POST /:id/schedule (scheduledAt)
        API->>Svc: scheduleRelease()
        Svc->>BullMQ: Add job to scheduledReleaseQueue
        Svc->>DB: UPDATE Release SET status = 'SCHEDULED'
        API-->>Admin: 200 OK (Scheduled)
        BullMQ->>Worker: Trigger at scheduledAt
        Worker->>DB: Transaction: UPDATE EnvironmentState.activeVersionId
        Worker->>DB: UPDATE Release SET status = 'COMPLETED'
    end
```

---

## 3. Step-by-Step Execution Trace

### Phase 1: Environment Diff & Version Suggestion
1. **Diff Calculation**: [`ReleaseService.getEnvironmentDiff()`](file:///home/eteknas/Projects/easystack-backend/src/services/release.service.ts) fetches the active `FeedVersion` documents from MongoDB for both the source environment and target environment. It compares JSON keys and content values, categorizing changes into `added`, `modified`, and `removed`.
2. **SemVer Recommendation**: Inspects whether schema changes occurred:
   - Structural key alterations or deletions -> Recommends `MINOR` or `MAJOR` bump.
   - Translation or content-only changes -> Recommends `PATCH` bump.

### Phase 2: Creation & Snapshot Freezing
1. **Freezing Snapshot**: Creating a release locks the exact state of all project feeds and schemas in the source environment.
2. **Relational Records**: In MySQL, a `Release` record is created with relations to `ReleaseFeed` and `ReleaseSchema`. These junction records store the exact MongoDB `versionId` strings at the moment of release creation.
3. **Immutability Guarantee**: Even if developers continue modifying the draft in the `development` environment, the release snapshot remains immutable.

### Phase 3: Deployment Execution
1. **Pointer Switch**: Deployment is performed within a Prisma transaction.
   - For every feed included in the release, the target environment's pointer in `EnvironmentState` is updated:
     ```typescript
     await tx.environmentState.upsert({
       where: { environmentId_feedId: { environmentId: targetEnv.id, feedId } },
       update: { activeVersionId: releaseFeed.versionId },
       create: { environmentId: targetEnv.id, feedId, activeVersionId: releaseFeed.versionId }
     });
     ```
2. **Instant Rollback**: If a deployment introduces a critical issue, `ReleaseService.rollbackRelease()` inspects the preceding completed release for that target environment and switches `activeVersionId` pointers back to the prior release's snapshots in a single atomic transaction.
