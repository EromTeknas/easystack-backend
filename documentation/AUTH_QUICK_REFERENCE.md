# Authentication System - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Set Environment Variables
```bash
# .env
JWT_SECRET=your-secret-key-change-this
JWT_REFRESH_SECRET=your-refresh-secret-key
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=noreply@domain.com
```

### 2. Run Migrations
```bash
npm run migrate:up
```

### 3. Test Auth Flow
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Verify Email (check inbox for OTP)
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"userId": "...", "otpCode": "123456"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'

# Get Current User
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## 📊 API Endpoints Cheat Sheet

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/register` | POST | ❌ | Create account, send OTP |
| `/auth/verify-email` | POST | ❌ | Verify OTP, get tokens |
| `/auth/resend-otp` | POST | ❌ | Resend OTP to email |
| `/auth/login` | POST | ❌ | Authenticate, get tokens |
| `/auth/refresh` | POST | ❌ | Rotate tokens |
| `/auth/logout` | POST | ❌ | Revoke tokens |
| `/auth/me` | GET | ✅ | Get user + workspaces |

**Auth** = Requires Bearer token in Authorization header

---

## 🔑 Token Lifecycle

```
┌─────────────────────────────────────────────┐
│           User Registration                 │
│ 1. POST /register (email, password)         │
│ 2. → Unverified user created                │
│ 3. → OTP sent via email                     │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         Email Verification                  │
│ 1. POST /verify-email (userId, otpCode)     │
│ 2. → Email marked as verified               │
│ 3. → Access Token issued (15 min)           │
│ 4. → Refresh Token issued (30 days)         │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         User Authenticated                  │
│ 1. Can now call protected endpoints         │
│ 2. Use Access Token in Authorization header │
└────────────────┬────────────────────────────┘
                 │
          (After 15 minutes)
                 │
                 ▼
┌─────────────────────────────────────────────┐
│        Token Refresh                        │
│ 1. POST /refresh (uses refreshToken cookie) │
│ 2. → Old refresh token REVOKED              │
│ 3. → New Access Token issued                │
│ 4. → New Refresh Token issued               │
│ 5. → Cookie updated automatically           │
└────────────────┬────────────────────────────┘
                 │
            (User logout)
                 │
                 ▼
┌─────────────────────────────────────────────┐
│          User Logged Out                    │
│ 1. POST /logout                             │
│ 2. → All refresh tokens REVOKED             │
│ 3. → Cookie cleared                         │
│ 4. → Must login again                       │
└─────────────────────────────────────────────┘
```

---

## 📋 Request/Response Formats

### Register
```json
REQUEST:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

RESPONSE (201):
{
  "success": true,
  "data": {
    "userId": "550e8400...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "nextStep": "verify-email"
  }
}
```

### Verify Email
```json
REQUEST:
{
  "userId": "550e8400...",
  "otpCode": "123456"
}

RESPONSE (200):
{
  "success": true,
  "data": {
    "user": {...},
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}

COOKIE SET:
refreshToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

### Login
```json
REQUEST:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

RESPONSE (200):
{
  "success": true,
  "data": {
    "user": {...},
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}

COOKIE SET:
refreshToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

### Get Current User
```json
REQUEST:
GET /auth/me
Authorization: Bearer eyJhbGc...

RESPONSE (200):
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400...",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true,
      "status": "active",
      "createdAt": "2026-01-27T..."
    },
    "workspaces": [
      {
        "id": "ws-uuid...",
        "name": "My Workspace",
        "role": "OWNER",
        "createdAt": "2026-01-27T..."
      }
    ]
  }
}
```

---

## 🔐 Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Email and password are required",
    "code": "BAD_REQUEST"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Invalid email or password",
    "code": "UNAUTHORIZED"
  }
}
```

### Email Not Verified
```json
{
  "success": false,
  "error": {
    "message": "Please verify your email before logging in",
    "code": "EMAIL_NOT_VERIFIED",
    "userId": "550e8400..."
  }
}
```

### Invalid OTP
```json
{
  "success": false,
  "error": {
    "message": "Invalid OTP code",
    "code": "UNAUTHORIZED"
  }
}
```

### Conflict (Email Exists)
```json
{
  "success": false,
  "error": {
    "message": "Email already registered",
    "code": "CONFLICT",
    "field": "email"
  }
}
```

---

## 🛡️ Security Checklist

- [ ] JWT_SECRET is strong (32+ chars, random)
- [ ] JWT_REFRESH_SECRET is different from JWT_SECRET
- [ ] BREVO_API_KEY is configured
- [ ] NODE_ENV=production in prod
- [ ] HTTPS/TLS enabled
- [ ] Cookies set to secure=true
- [ ] CORS configured with whitelist
- [ ] Database has backups
- [ ] Monitoring/alerting enabled
- [ ] Rate limiting working

---

## 🧪 Testing Commands

```bash
# Register a user
USER_ID=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }' | jq -r '.data.userId')

echo "User ID: $USER_ID"

# Verify email (use OTP from email)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"userId": "'$USER_ID'", "otpCode": "123456"}' \
  | jq -r '.data.accessToken')

echo "Access Token: $TOKEN"

# Get current user
curl -s -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq

# Refresh token
curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=..." \
  | jq

# Logout
curl -s -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: refreshToken=..." \
  | jq
```

---

## 📱 Frontend Integration Example

```typescript
// store/auth.ts
interface AuthState {
  accessToken: string | null;
  user: User | null;
  workspaces: Workspace[];
}

// Register
async function register(email, password, firstName, lastName) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName, lastName })
  });
  const data = await res.json();
  return data.data.userId; // Redirect to verify-email
}

// Verify Email
async function verifyEmail(userId, otpCode) {
  const res = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, otpCode }),
    credentials: 'include' // Include cookies
  });
  const data = await res.json();
  setAccessToken(data.data.accessToken);
  setUser(data.data.user);
  return true;
}

// Login
async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include'
  });
  const data = await res.json();
  setAccessToken(data.data.accessToken);
  setUser(data.data.user);
}

// Protected API Call
async function getMe() {
  const res = await fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return res.json();
}

// Auto-refresh on token expiry
async function refreshToken() {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Include refreshToken cookie
  });
  const data = await res.json();
  setAccessToken(data.data.accessToken);
}

// Logout
async function logout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  setAccessToken(null);
  setUser(null);
}
```

---

## 🎯 Key Takeaways

1. **Email verification required** - Users must verify before login
2. **Tokens auto-managed** - Refresh token stored in HTTP-only cookie
3. **Token rotation** - Old tokens revoked, new ones issued
4. **Role-based access** - Control access via workspace roles
5. **Multi-tenancy built-in** - Users can belong to multiple workspaces
6. **Production-ready** - Security-first design with full logging

---

## 📚 Documentation Links

- Full Reference: [AUTHENTICATION_ADVANCED.md](./AUTHENTICATION_ADVANCED.md)
- Setup Guide: [AUTH_SETUP.md](./AUTH_SETUP.md)
- Files Reference: [FILES_REFERENCE.md](./FILES_REFERENCE.md)
- Implementation Summary: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

