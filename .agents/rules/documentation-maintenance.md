---
trigger: always_on
description: Mandatory documentation maintenance for every implementation change.
---

# Mandatory Documentation Maintenance

## Objective

Documentation must remain synchronized with the actual application implementation throughout the development lifecycle.

The project maintains:
- The `codebase-documentation` (or `code-documentation`) skill.
- A structured `documentation/` directory containing architecture, module references, workflows, and technical documentation.

You must use the existing documentation skill whenever documentation needs to be created, updated, reorganized, or validated.

Documentation must be treated as an integral part of the implementation, not as an optional task after development.

---

## Rule Requirements

### 1. Documentation-First Approach

Before implementing a new feature or modifying existing functionality:

1. Read `documentation/README.md` or the existing documentation index (`documentation/INDEX.md` or `documentation/ARCHITECTURE.md`).
2. Identify and read relevant module and architecture documentation.
3. Understand existing implementation patterns and constraints.
4. Identify which documentation files may be affected by the proposed changes.
5. Use the `codebase-documentation` / `code-documentation` skill when necessary to understand or document the implementation.

Do not unnecessarily explore the entire codebase when existing documentation provides sufficient context.

---

### 2. Mandatory Documentation Updates

Whenever implementation changes affect documented behavior or technical structure, update the relevant documentation as part of the same task.

This applies to:

- New features.
- Existing feature modifications.
- New modules, services, components, or repositories.
- API additions, modifications, or removals.
- Database model changes (Prisma schema, MongoDB models).
- Database relationships, indices, and migrations.
- Authentication and authorization changes.
- RBAC and permission changes.
- Background jobs, workers, and queue processing.
- External integrations.
- Configuration and environment changes.
- Business workflows.
- Shared utilities and architectural patterns.
- Deployment and infrastructure changes.
- Important bug fixes that alter system behavior.

Documentation updates are mandatory even when the user does not explicitly request them.

---

### 3. Keep Documentation Implementation-Driven

Documentation must describe what is actually implemented in the codebase.

- Never document planned functionality as completed.
- Never make assumptions about implementation.
- Use actual, verified source file paths.
- Update outdated descriptions immediately.
- Update Mermaid diagrams when architecture, component relationships, or workflows change.
- Update API contracts when endpoints, query params, or payloads change.
- Update module references when files are moved or renamed.
- Remove references to deleted or deprecated functionality.
- Maintain consistency across related documents.

---

### 4. Use the Codebase Documentation Skill

When documentation requires substantial changes:

1. Invoke the `codebase-documentation` / `code-documentation` skill.
2. Follow its documentation standards and structure.
3. Inspect the relevant implementation thoroughly.
4. Update affected documentation files.
5. Validate all references against the source code.

For small changes, follow the same documentation conventions without unnecessarily regenerating unrelated documentation.

---

### 5. Scope and Efficiency

Do not regenerate the entire documentation directory for every code change.

Instead:

- Identify the documentation directly affected by the change.
- Update only relevant documents.
- Update cross-references where necessary.
- Avoid duplicating existing information.
- Keep the master documentation index (`README.md` / `INDEX.md`) updated when new documentation files are introduced.
- Preserve the existing documentation structure unless a structural improvement is genuinely needed.

---

### 6. Documentation Accuracy Checks

Before completing a task, verify:

- All relevant documentation has been updated.
- Source file references and paths are correct.
- API and database descriptions match actual implementation.
- Diagrams reflect actual system behavior.
- No outdated implementation details remain.
- No secrets, credentials, or sensitive environment tokens have been documented.

---

### 7. Completion Reporting

At the end of every implementation task, include a dedicated section in your final response:

### Documentation Updates
- **Files Created**: List newly created documentation files (or "None").
- **Files Modified**: List modified documentation files (or "None").
- **Architectural / Workflow Updates**: Summary of architecture, diagram, or workflow updates made.
- **No Changes Justification**: If documentation changes were not required, provide a brief, explicit reason (e.g., internal refactor with no public API, schema, or behavioral change).

If documentation should have changed but could not be updated, explicitly report why.

---

## Important Rules

- Documentation updates are part of implementation completion; a task is incomplete if documentation is left out of date.
- Never silently skip documentation updates.
- Do not modify application code solely to make documentation easier.
- Do not create redundant documentation.
- Do not overwrite useful existing documentation without reviewing it.
- Keep documentation concise, navigable, and optimized for future AI agents.

---

## Expected Outcome

Future Antigravity sessions should always have access to accurate, up-to-date documentation.

An agent should never have to rediscover architectural decisions, module relationships, or business workflows simply because a previous implementation was not documented.
