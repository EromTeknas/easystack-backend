# Planned & Pending Features Reference

> [!NOTE]
> **Status**: PENDING IMPLEMENTATION
> The features outlined in this document are design proposals and architectural roadmaps. They are **NOT** yet implemented in the application source code.
> AI agents and developers should NOT assume these endpoints, queues, or services currently exist.

---

## 1. Notification Engine & Preference System

### Overview
To tighten collaboration loops during translation reviews, an asynchronous notification system is planned using BullMQ (`notificationQueue`) and a dedicated worker (`NotificationWorker`).

### Planned Triggers & Delivery Channels

| Event Trigger | Recipients | In-App Bell | Email Notification |
|---|---|---|---|
| **Review Requested** | Users explicitly added to the `reviewers` array | Yes | Yes |
| **Reviewer Added Late** | Newly added reviewer | Yes | Yes |
| **Translation Approved** | Original author of the review request | Yes | Yes |
| **Approvals Reset (Push Reset)**| All reviewers who had previously marked `APPROVED` | Yes | Yes |
| **@Mentions** | Tagged users in Tiptap rich-text comment nodes | Yes | Optional (per preference) |
| **Thread Reply** | Author of root comment and prior thread participants | Yes | Optional (per preference) |

### Prerequisites for Implementation
- **Frontend UI Infrastructure**: Requires user interface components (notification bell, unread counters, in-app toast banners) before enabling backend event dispatch.
- **User Preference Model**: Requires adding notification preference toggles to the `User` Prisma schema (email frequency, muted projects).

---

## 2. Advanced Stripe Customer Portal Integration

### Overview
While the webhook pipeline (`POST /api/billing/webhook/stripe`) and Prisma subscription models are fully implemented, direct self-service customer portal session generation and credit card update redirection remain planned for a future client iteration.
