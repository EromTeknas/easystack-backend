# Documentation Maintenance Guidelines for AI Coding Agents

> **Primary Audience**: Antigravity, Google Gemini, and other autonomous AI coding agents operating on this repository.

This knowledge base is engineered specifically to eliminate repetitive, full-codebase directory traversals. To preserve the accuracy, high retrieval speed, and reliability of this documentation system, all AI coding agents must follow the operational guidelines set forth below.

---

## 1. How AI Agents Should Read This Documentation

1. **Start at [`documentation/README.md`](file:///home/eteknas/Projects/easystack-backend/documentation/README.md)**:
   - Before exploring raw source code directories, read the Master Index.
   - Use the **Decision-Oriented Navigation Table** to instantly locate the files, modules, and workflows pertinent to your prompt.
2. **Selective Reading (Avoid Whole-Doc Scanning)**:
   - Do NOT load the entire `documentation/` directory into context.
   - Read only the specific module document (e.g., [`documentation/modules/billing.md`](file:///home/eteknas/Projects/easystack-backend/documentation/modules/billing.md)) and its corresponding workflow (e.g., [`documentation/workflows/billing-quota-enforcement.md`](file:///home/eteknas/Projects/easystack-backend/documentation/workflows/billing-quota-enforcement.md)).
3. **Direct-to-Code Navigation**:
   - Use the **File Responsibility Maps** in the module documentation to jump directly to the relevant controller, service, repository, or model.
4. **Source Code as Source of Truth**:
   - If an edge case is not covered or if a documentation claim appears inconsistent with the actual implementation, treat the source code as the ultimate source of truth.

---

## 2. When and How to Update Documentation

When completing tasks in this repository, you must maintain documentation synchronization under the following circumstances:

### A. When You Add a New Route or Endpoint
1. Add the endpoint to [`documentation/technical-reference/api-directory.md`](file:///home/eteknas/Projects/easystack-backend/documentation/technical-reference/api-directory.md) with HTTP method, path, security guards (`authenticate`, `authorize`, `billingMiddleware`), and controller name.
2. Update the corresponding module document in `documentation/modules/`.

### B. When You Add or Modify a Relational or Document Model
1. Update [`documentation/technical-reference/polyglot-schema-reference.md`](file:///home/eteknas/Projects/easystack-backend/documentation/technical-reference/polyglot-schema-reference.md).
2. If adding a relational model, update `prisma/schema.prisma` and ensure `removedAt: DateTime?` soft-deletion fields are documented.

### C. When You Add an Environment Variable
1. Update [`documentation/technical-reference/configuration.md`](file:///home/eteknas/Projects/easystack-backend/documentation/technical-reference/configuration.md) with variable name, data type, purpose, and default value.
2. Update `.env.example`.

### D. When You Add or Alter a Background Worker or Queue
1. Update [`documentation/modules/workers-and-queues.md`](file:///home/eteknas/Projects/easystack-backend/documentation/modules/workers-and-queues.md).
2. Document the worker group key, processor, and repeatable schedule in `src/workers/register-schedules.ts`.

### E. When Moving or Renaming Files
1. Update the **File Responsibility Map** in the corresponding module document.
2. Update the clickable markdown links.
3. Verify with ripgrep that no broken documentation links remain.

---

## 3. Strict Documentation Rules for Future Agents

1. **No Hallucinations or Assumed APIs**: Never document planned or assumed features as though they were implemented. If documenting a roadmap proposal, place it in [`documentation/reference/planned-features.md`](file:///home/eteknas/Projects/easystack-backend/documentation/reference/planned-features.md) with an explicit `PENDING IMPLEMENTATION` disclaimer.
2. **Preserve Clickable File Links**: Always use markdown links referencing absolute or relative paths with file basenames (e.g. `[filename.ts](path/to/filename.ts)`).
3. **Synchronize Diagrams with Code**: If an execution flow or state machine changes, update the Mermaid diagram in [`documentation/architecture/diagrams.md`](file:///home/eteknas/Projects/easystack-backend/documentation/architecture/diagrams.md) and the relevant workflow file.
4. **Avoid Gratuitous Rewrites**: Do not rephrase, rewrite, or churn unrelated documentation. Make surgical, accurate updates directly where code changes occurred.
5. **Never Commit Secrets**: Never insert real API keys, passwords, JWT secrets, or production connection strings into documentation examples. Always use placeholder tokens (e.g., `your-secret-key-min-32-chars`).
