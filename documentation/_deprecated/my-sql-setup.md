# MySQL Setup Guide (Ubuntu)

This document explains how to install, configure, and prepare MySQL for use with the **easystack-backend** Node.js application.

---

## 1. Install MySQL

Update package lists and install MySQL server:

```bash
sudo apt update
sudo apt install mysql-server -y
```

Verify
```bash
mysql --version
```

## 2. Start & Check MySQL Service
```bash
sudo systemctl start mysql
sudo systemctl status mysql
```

(Optional) Enable auto-start on boot:
```bash
sudo systemctl enable mysql
```
# MySQL Setup Guide (Ubuntu)

This guide shows how to install, configure, and prepare MySQL for use with the easystack-backend Node.js application.

## Table of Contents
- [Install MySQL](#install-mysql)
- [Start & Check MySQL Service](#start--check-mysql-service)
- [Initial Login](#initial-login)
- [Create Application Database](#create-application-database)
- [Create a Dedicated Application User](#create-a-dedicated-application-user)
- [Verify Authentication Plugin](#verify-authentication-plugin)
- [Test Login as App User](#test-login-as-app-user)
- [Configure Backend Environment Variables](#configure-backend-environment-variables)
- [Common Errors & Fixes](#common-errors--fixes)
- [Reset Password for MySQL User](#reset-password-for-mysql-user)
- [Security Best Practices](#security-best-practices)
- [Production Notes](#production-notes)
- [Setup Checklist](#setup-checklist)

---

## Install MySQL

Update package lists and install MySQL server:

```bash
sudo apt update
sudo apt install mysql-server -y
```

Verify installation:

```bash
mysql --version
```

## Start & Check MySQL Service

Start and check status:

```bash
sudo systemctl start mysql
sudo systemctl status mysql
```

(Optional) Enable auto-start on boot:

```bash
sudo systemctl enable mysql
```

## Initial Login

On Ubuntu the root MySQL account often uses `unix_socket` authentication. To access the MySQL shell as root:

```bash
sudo mysql
```

You should see the MySQL prompt (`mysql>`).

## Create Application Database

Create the database used by the application:

```sql
CREATE DATABASE easystack
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

SHOW DATABASES;
```

## Create a Dedicated Application User (recommended)

Do not use `root` for application connections. Create a dedicated user:

```sql
CREATE USER 'easystack'@'localhost' IDENTIFIED BY 'StrongPasswordHere';
GRANT ALL PRIVILEGES ON easystack.* TO 'easystack'@'localhost';
FLUSH PRIVILEGES;
```

## Verify Authentication Plugin

Check the authentication plugin for the user:

```sql
SELECT user, host, plugin
FROM mysql.user
WHERE user = 'easystack';
```

For many Node.js drivers the recommended plugin is `mysql_native_password`. If you need to force it:

```sql
ALTER USER 'easystack'@'localhost'
  IDENTIFIED WITH mysql_native_password BY 'StrongPasswordHere';
FLUSH PRIVILEGES;
```

## Test Login as App User

Exit the MySQL shell if needed:

```sql
EXIT;
```

Then test connecting as the application user:

```bash
mysql -u easystack -p -h localhost easystack
```

## Configure Backend Environment Variables

Add or update the following keys in your `.env` file used by the backend:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=easystack
MYSQL_PASSWORD=StrongPasswordHere
MYSQL_DATABASE=easystack
```

Restart your backend after changing environment variables.

## Common Errors & Fixes

- `Access denied for user 'root'@'localhost'`
  - Cause: root may be using socket authentication. Do not use root for the application — create/use a dedicated user.

- `Access denied for user 'easystack'`
  - Causes: wrong password, wrong auth plugin, or missing privileges.
  - Fix example (reset plugin & password, grant privileges):

```sql
ALTER USER 'easystack'@'localhost'
  IDENTIFIED WITH mysql_native_password BY 'NewPassword';
GRANT ALL PRIVILEGES ON easystack.* TO 'easystack'@'localhost';
FLUSH PRIVILEGES;
```

## Reset Password for MySQL User

To reset the password for the application user:

```bash
sudo mysql

ALTER USER 'easystack'@'localhost' IDENTIFIED BY 'NewStrongPassword';
FLUSH PRIVILEGES;
```

Update your `.env` file with the new password.

## Security Best Practices

- Do not use `root` for application connections.
- Create one dedicated DB user per application.
- Use strong, unique passwords.
- Limit privileges in production to the minimum required.
- Bind MySQL to `localhost` where appropriate.
- Run `sudo mysql_secure_installation` to harden the instance.

## Production Notes

- Use connection pooling (for example, `mysql2/promise`) in the application.
- Add startup health checks and retry logic for DB connectivity.
- Handle graceful shutdown to close DB pools.
- Consider running MySQL in a managed service or Docker container in production.

## Setup Checklist

- [ ] MySQL installed and running
- [ ] Database `easystack` created
- [ ] Application DB user created
- [ ] Privileges granted to the app user
- [ ] CLI login works for the app user
- [ ] `.env` configured with DB credentials
- [ ] Backend connects successfully

---

MySQL is now ready for use with easystack-backend.

---

## Next Steps

- [Setup Guide](SETUP_GUIDE.md) - Back to complete setup guide
- [MongoDB Setup](mongo-db-setup.md) - Set up MongoDB as well
- [Local Development](LOCAL_DEVELOPMENT.md) - Start developing

---

[← Back to README](../README.md)
