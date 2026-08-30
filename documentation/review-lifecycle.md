# Translation Review Lifecycle & Collaboration

## Overview
Easystack uses a single-threaded, PR-style review lifecycle embedded directly into the chat system. Instead of maintaining a separate "Reviews" collection and a "Comments" collection, **everything is a Comment**.

A Translation can only have **one active review** at a time. This single review thread collects approvals, resets dynamically when content changes, and allows continuous discussion until the translation is ultimately approved.

## State Machine
The lifecycle revolves around the `status` of a `REVIEW_REQUEST` comment.

- **\`ACTIVE\`**: A review has been requested. Reviewers are actively voting.
- **\`OUTDATED\`**: The review thread is closed. This happens if:
  1. The author explicitly closes it.
  2. A *new* review is requested (which automatically marks any previously `ACTIVE` review as `OUTDATED`).

### Automatic Approval Reset (The "Push" mechanic)
Just like pushing a new commit to a GitHub PR resets approvals, making changes to the translation text (or the base English text) triggers a system reset.
If a translation has an `ACTIVE` review request:
- Editing the localized content resets all `APPROVED` voters back to `PENDING`.
- Editing the base English content resets all `APPROVED` voters back to `PENDING`.

## System Generated Messages
To maintain a clear history within the chat UI, the backend automatically injects "System Comments" into the thread when major actions occur. These comments are recognizable by `isSystem: true` and have a `null` author object (because they use `authorId: -1` in the database). 

The following system events are automatically logged into the comment timeline:

| Action | Injected Message |
| :--- | :--- |
| **Request Review** | \`<Author> has asked for a review. <Optional User Text>\` (Root Comment) |
| **Approve** | \`<Reviewer Name> approved the translation.\` (Reply in thread) |
| **Add Reviewer** | \`<Author Name> added <New User> as reviewers.\` (Reply in thread) |
| **Close Review** | \`<Author Name> closed this review request.\` (Reply in thread) |
| **Author updates translation text** | \`<Author Name> made changes to the translation. Approvals have been reset.\` (Reply in thread) |
| **Author updates base English text** | \`<Author Name> made changes to the base content. Approvals have been reset.\` (Reply in thread) |

## Edge Cases Handled

1. **Mark STALE as Correct Bypassing**: 
   When the English base text changes, the translation is marked `STALE`. If the user hits the "Mark as Correct" button, it marks it `COMPLETED` without saving any text.
   *Edge Case Prevented*: The backend actively checks if the base *structure* (JSON keys) changed. If the structure is mismatched, the backend explicitly blocks the action and throws a `400 Bad Request`. The user must manually edit the text to fix the JSON keys.
2. **Missing Users / Prisma Lookup Crashes**:
   System comments map to `authorId: -1`. The backend gracefully catches missing or negative IDs and explicitly yields `author: null` to the frontend, preventing Prisma `findUnique` crashes and naturally signaling to the UI that it's a system message.
3. **Mongoose Nested Array Bug**:
   Mongoose is notoriously bad at tracking and saving mutations inside deeply nested arrays (e.g. `doc.reviewers[i].status = 'PENDING'`). To safely reset approvals during text updates, we use MongoDB's raw atomic positional operator (`$[]`): 
   \`{ $set: { "reviewers.$[].status": "PENDING" } }\`
4. **Content Scrubbing (Privacy)**:
   If a comment is deleted, its status is changed to `DELETED`. However, to ensure maximum privacy, the backend dynamically scrubs `doc.content = null` before sending the payload over the wire to the frontend.
5. **No Parallel Active Reviews**:
   If a user tries to create a new review request while one is already `ACTIVE`, the backend automatically finds the old one, marks it `OUTDATED`, and initializes the new thread.
