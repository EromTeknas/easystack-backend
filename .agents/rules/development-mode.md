# Development Mode & Single Version Rule (Zero Backward Compatibility)

## Core Directive

This project is in active development mode. Backward compatibility is strictly NOT required and MUST NOT be maintained.

Always maintain only a single, latest canonical version of code, data structures, and APIs.

---

## Invariants

1. **Single Canonical Version**:
   - Maintain only the latest canonical implementation.
   - Do not maintain version bridges, multi-version fallback branches, or legacy compatibility shims.

2. **Clean Up Obsolete Code Directly**:
   - When introducing or refactoring a pattern, update all consumers directly to the new pattern.
   - Remove deprecated functions, unused parameter aliases, and legacy conditional branches immediately instead of keeping them around for backward compatibility.

3. **No Migration Bridges or Shims**:
   - Do not add complex runtime compatibility layers for obsolete data formats or discontinued endpoints.
   - Update schemas, database seeds, and active code directly to reflect the latest state.

4. **Consistency Across Frontend & Backend**:
   - Both backend API routes and frontend API clients must strictly use the single current contract.
