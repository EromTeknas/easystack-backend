# Database Migrations

Version-controlled database schema management. Migrations track and execute database changes consistently across all environments.
## Deployment Workflow

### Development
```bash
npm install
npm run prisma:migrate
```

### Staging/Production
```bash
# 1. Deploy new code
git pull origin main

# 2. Apply Prisma migrations (typically via CI/CD)
npx prisma migrate deploy

# 3. Start application
npm run build
npm start
```

---

## Troubleshooting

- Check that `DATABASE_URL` and `SHADOW_DATABASE_URL` are set and point to the correct databases.
- Ensure the migration user has privileges on both the main and shadow databases.
- Inspect the SQL in `prisma/migrations/**/migration.sql` when a migration fails.

---

## Links

- [Authentication Documentation](../AUTHENTICATION.md)
- [Setup Guide](../SETUP_GUIDE.md)
- [Files Reference](../FILES_REFERENCE.md)

````

**Fields**:
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
user_id         BIGINT (FK -> users.id, ON DELETE SET NULL)
action          VARCHAR(50)
resource        VARCHAR(100)
ip_address      VARCHAR(45)
user_agent      TEXT
status          ENUM('success', 'failure')
error_message   TEXT
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Purpose**: Maintains an audit trail of important user actions for security and compliance.

---

### 003-create-workspace-members ✅

**Creates**: `workspace_members` table for workspace access control in the legacy system. New environments should rely solely on Prisma migrations for schema.

---

### 004-create-email-otps ✅

**Creates**: `email_otps` table for email verification in the legacy system. New environments use Redis-based OTP flows and Prisma schema.

---

**Q: What if a migration fails halfway?**  
A: The transaction rolls back. Fix the issue and run again.

**Q: Can I skip a migration?**  
A: Migrations must run in order. This ensures consistency.

**Q: How do I share database schema with the team?**  
A: Prisma migrations are in git. Everyone runs `npm run prisma:migrate` (locally) or `prisma migrate deploy` (via CI/CD) against their database.

**Q: What about production data?**  
A: Migrations should not delete data. Use `ALTER TABLE` not `DROP TABLE`.

---

## Links

- [Authentication Documentation](../AUTHENTICATION.md) - Authentication system design and email verification flow
- [Setup Guide](../SETUP_GUIDE.md) - Initial project setup
- [Files Reference](../FILES_REFERENCE.md) - Project file structure
