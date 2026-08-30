# Audit Logs

## Overview
Easystack maintains a strict audit trail for all major structural and translation changes to Feeds. This is powered by the `FeedAuditLog` MongoDB collection.

Audit logs are meant for **major state changes** and administrative actions. Day-to-day chat messages and general comments are specifically **excluded** from the audit log to prevent noise.

## Tracked Actions (`FeedAuditLog.action`)

The backend tracks the following enum actions:

| Action enum | Trigger Condition | Notes stored in DB |
| :--- | :--- | :--- |
| \`CREATED_VERSION\` | A brand new draft version is cloned or initialized. | "Created a new draft version" |
| \`UPDATED_BASE\` | The English base text or structure was explicitly updated/saved. | "Updated base content in <Env>" |
| \`UPDATED_TRANSLATION\` | A foreign language translation was saved, OR a STALE translation was successfully marked as correct. | "Updated <Lang> translation" OR "Marked STALE translation as COMPLETED without changes" |
| \`GENERATED_TRANSLATION\` | The AI Auto-Translate background worker successfully fulfilled a translation task. | "Auto-generated translation for <Lang>" |
| \`REQUESTED_REVIEW\` | The author created a new `REVIEW_REQUEST` thread. | "Requested review for <Lang>" |
| \`APPROVED_TRANSLATION\` | A reviewer clicked Approve on an active review thread. | "Approved <Lang> translation" |

*(Note: `ADDED_COMMENT` was explicitly stripped from the audit logs to prevent database bloat and ensure only high-level workflow events are audited).*

## Endpoints
* **`GET /api/projects/:projectId/feeds/:feedId/audit-logs`**: Fetches the paginated chronological history of the feed. Automatically populates the `userId` to return full author information to the frontend.
