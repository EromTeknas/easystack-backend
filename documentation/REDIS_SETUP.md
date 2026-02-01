# Redis Setup

This document explains how Redis is used and how to configure it for the EasyStack backend.

---

## What Redis Is Used For

Redis is a required dependency for the authentication flows:

- **Email OTP verification**
  - Hashed OTP codes and attempt counters are stored in Redis.
  - Keys: `email_otp:<userId>`.
- **Password reset tokens**
  - High-entropy, hashed reset tokens are stored in Redis.
  - Keys: `password_reset:<token>` (token maps to a userId stored in the hash).
- **BullMQ queues**
  - All queues (`email-otp-queue`, `password-reset-queue`, `welcome-email-queue`) use Redis for job storage.

No OTPs or reset tokens are stored in MySQL.

---

## Local Installation

For local development, you can install Redis with your package manager, for example on Ubuntu:

```bash
sudo apt-get update
sudo apt-get install redis-server
```

Then start Redis:

```bash
sudo service redis-server start
```

Or using Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

---

## Environment Variables

Configure Redis via `.env`:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=10
```

These are consumed by `src/config/redis.ts` to create a shared `redisClient` and `redisConnectionOptions` used by:

- OTP Redis service (`src/services/otp-redis.service.ts`).
- Password reset Redis service (`src/services/password-reset-redis.service.ts`).
- BullMQ queues under `src/queues/`.

---

## Verifying Connectivity

From a terminal:

```bash
redis-cli -h $REDIS_HOST -p $REDIS_PORT PING
```

You should see:

```text
PONG
```

You can also inspect keys:

```bash
redis-cli KEYS "email_otp:*"
redis-cli KEYS "password_reset:*"
```

These commands should show OTP and password reset keys after running the relevant flows.

---

## Troubleshooting

- **Connection refused**
  - Ensure Redis is running and listening on the configured host/port.
- **Authentication errors**
  - If Redis has a password, set `REDIS_PASSWORD` accordingly.
- **Stale keys**
  - OTP and reset tokens have TTLs; if you need a clean state in development, you can run:

```bash
redis-cli FLUSHDB
```

(Only do this in development or on a non-shared DB.)

---

## Production Notes

- Use a managed Redis service or a properly secured instance (password, network rules).
- Monitor memory usage and key counts.
- Configure persistence as per your operational requirements.
- Run at least one worker process (`npm run worker`) in your deployment to process queues.
