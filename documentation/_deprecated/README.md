# Deprecated Documentation

This folder contains outdated documentation files that have been consolidated into single, comprehensive guides.

## Why These Files Are Here

As part of documentation organization, we consolidated multiple files covering the same topics into single, canonical documents. This reduces duplication and makes documentation easier to maintain.

## File Consolidation Map

### Authentication Documentation

**Deprecated Files:**
- `AUTHENTICATION_QUICK_START.md` - Quick start guide
- `AUTHENTICATION_ADVANCED.md` - Advanced concepts and implementation
- `AUTH_QUICK_REFERENCE.md` - Quick reference table
- `AUTH_SETUP.md` - Setup instructions

**Consolidated Into:** [AUTHENTICATION.md](../AUTHENTICATION.md)

The main authentication file now contains:
- Quick start section
- Complete architecture overview
- All API endpoints with examples
- Token flow diagrams
- Security implementation details
- Frontend integration examples
- Testing strategies
- Setup and configuration

### Database Setup Documentation

**Deprecated Files:**
- `mongo-db-setup.md` - MongoDB installation and setup
- `my-sql-setup.md` - MySQL installation and setup
- `MIGRATIONS_SETUP.md` - Migrations system overview

**Consolidated Into:**
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - MongoDB and MySQL sections
- [MIGRATIONS.md](../MIGRATIONS.md) - Complete migrations guide

The main setup guide now includes:
- Both MongoDB and MySQL installation steps
- Environment configuration for both databases
- Security best practices for each database
- Troubleshooting for both systems

---

## How to Find Information

Instead of searching through multiple files, refer to these main documents:

| Topic | Location |
|-------|----------|
| **Authentication** | [AUTHENTICATION.md](../AUTHENTICATION.md) |
| **Database Setup** | [SETUP_GUIDE.md](../SETUP_GUIDE.md) |
| **Migrations** | [MIGRATIONS.md](../MIGRATIONS.md) |
| **Error Handling** | [ERROR_HANDLING.md](../ERROR_HANDLING.md) |
| **File Structure** | [FILE_STRUCTURE.md](../FILE_STRUCTURE.md) |
| **Local Development** | [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md) |

---

## Reference Only

These deprecated files are kept for reference but should not be used in new documentation. Always refer to the consolidated versions listed above.

If you need to look up something that was in these files, search in the consolidated file instead:

```bash
# Search for "OTP" in authentication docs
grep -i "OTP" ../AUTHENTICATION.md

# Search for "MySQL" in setup docs
grep -i "MySQL" ../SETUP_GUIDE.md

# Search for "migrations" in migrations docs
grep -i "migrations" ../MIGRATIONS.md
```

---

## Consolidation Benefits

✅ **Single Source of Truth** - No conflicting information across files
✅ **Easier Maintenance** - Update one file instead of many
✅ **Better Navigation** - Main docs link to related sections
✅ **Comprehensive** - All related info in one place
✅ **Reduced Duplication** - No repeated content

---

[← Back to README](../../README.md)
