# Database Migrations

Version-controlled database schema management. Migrations track and execute database changes consistently across all environments.
## Deployment Workflow
# Database Migrations

Version-controlled database schema management using Prisma. Migrations track and execute database changes consistently across all environments.

---

## Quick Start

### First Time Setup (Local, MySQL)

```bash
npm install

# Ensure .env has DATABASE_URL and SHADOW_DATABASE_URL set
npm run prisma:migrate
```

This applies all Prisma migrations in `prisma/migrations` to your local database.

---

## Commands

```bash
npm run prisma:migrate   # Run Prisma migrations in development
npm run prisma:generate  # Regenerate Prisma client after schema changes
```

In CI/staging/production you typically use:

```bash
npx prisma migrate deploy
```

to apply already-generated migrations without creating new ones.

---

## How It Works

- The datasource in `prisma/schema.prisma` is configured as:

	```prisma
	datasource db {
		provider          = "mysql"
		url               = env("DATABASE_URL")
		shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
	}
	```

- `DATABASE_URL` and `SHADOW_DATABASE_URL` use the migration user credentials so Prisma can create and alter tables and manage the shadow database.
- The running application uses the app user from the MySQL config and does **not** execute migrations.

---

## Creating New Migrations

1. Edit `prisma/schema.prisma` to add or modify models/fields.
2. Run:

	 ```bash
	 npm run prisma:migrate
	 ```

3. Prisma will:
	 - Compare the schema with the database.
	 - Generate a new folder under `prisma/migrations/` with SQL.
	 - Apply the migration to your database.

4. Commit both `prisma/schema.prisma` and the new `prisma/migrations/**` folder.

---

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

## Best Practices

- Keep migrations small and focused on one logical change.
- Always review generated SQL in `prisma/migrations/**/migration.sql`.
- Commit migrations to git so all environments apply the same schema.
- Use the migration user for Prisma CLI; use the app user for the running API.

---

## Troubleshooting

- Check that `DATABASE_URL` and `SHADOW_DATABASE_URL` are set and valid.
- Ensure the migration user has privileges on both main and shadow databases.
- Inspect the failing migration SQL in `prisma/migrations/**/migration.sql`.

---

## Related Docs

- [Authentication Documentation](../AUTHENTICATION.md)
- [Setup Guide](../SETUP_GUIDE.md)
- [Files Reference](../FILES_REFERENCE.md)

