# Notifications Strategy (PENDING IMPLEMENTATION)

*Note: This feature requires frontend UI infrastructure (e.g., a notification bell, unread counters, or toast messages) before the backend queueing system is fully implemented.*

## Overview
To keep the review lifecycle and collaboration loops tight, the backend will leverage BullMQ workers to asynchronously dispatch both in-app notifications and emails based on system triggers.

## Planned Triggers & Payloads

### 1. Review Requested
* **Trigger:** Author initiates a `REVIEW_REQUEST` thread.
* **Recipients:** Users explicitly added to the `reviewers` array.
* **Format:** `[Author] has requested your review on the [Language] translation for '[Feed Name]'.`

### 2. Late Reviewer Added
* **Trigger:** Author adds a new reviewer to an already `ACTIVE` thread.
* **Recipients:** Only the newly added reviewer.
* **Format:** `[Author] has added you as a reviewer on the [Language] translation for '[Feed Name]'.`

### 3. Translation Approved
* **Trigger:** A reviewer clicks the "Approve" button.
* **Recipients:** The original Author of the review request.
* **Format:** `[Reviewer] has approved your [Language] translation.`

### 4. Approvals Reset / Text Changed
* **Trigger:** The Author updates the translation text while a review is `ACTIVE`.
* **Recipients:** All users in the `reviewers` array who had previously marked themselves as `APPROVED`.
* **Format:** `[Author] made changes to the [Language] translation you previously approved. Your approval has been reset.`

### 5. @Mentions
* **Trigger:** A user is explicitly tagged using a Tiptap `@mention` node.
* **Recipients:** The mentioned user(s).
* **Format:** `[Author] mentioned you in a comment on the [Language] translation.`

### 6. Thread Replies
* **Trigger:** A user replies to an existing root thread.
* **Recipients:** The author of the root comment, PLUS anyone who has previously replied to that specific thread (excluding the active author).
* **Format:** `[Author] replied to a thread you are participating in on the [Language] translation.`

## Proposed Architecture
1. **Queue:** Use BullMQ (`notificationQueue`) to avoid blocking the HTTP response on `collaboration.service.ts`.
2. **Worker:** A dedicated Node worker (`NotificationWorker`) will dequeue events.
3. **Preferences Engine:** The worker checks if the `targetUserId` has push notifications, emails, or in-app bell notifications enabled in their user settings before dispatching.
