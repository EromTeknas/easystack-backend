# Backend Coding Standards

1. **Architecture**: Route -> Controller -> Service -> Repository.
2. **Types**: Use strict TypeScript typing. Avoid \`any\` except for express \`req\` objects pending custom typing.
3. **Database**: Use Prisma.
4. **Soft Deletions**: Always check \`removedAt: null\` on relational joins (e.g., fetching members).
5. **Responses**: Use the unified \`ok(res, data)\` utility for HTTP 200 responses to maintain consistent JSON shapes.
