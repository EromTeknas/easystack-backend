# Advanced Authentication & Authorization System

## Overview

This document describes the complete, production-grade authentication and authorization system for EasyStack. The system supports:

- **Email + Password Authentication** with OTP email verification via Brevo
- **JWT-based Access Tokens** (short-lived, 15 minutes)
- **Refresh Token Rotation** (long-lived, 30 days, revoked after use)
- **Workspace-based Multi-tenancy** with role-based access control (RBAC)
- **Session Management** with revocation and tracking
- **Security-first Design** with bcrypt hashing, HTTP-only cookies, and token validation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Next.js)                        │
├─────────────────────────────────────────────────────────────┤
│ Stores: Access Token (memory), Refresh Token (HTTP cookie)  │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Server (Express)                       │
├─────────────────────────────────────────────────────────────┤
│ Auth Routes:                                                │
│  - POST /auth/register        → Creates unverified user    │
│  - POST /auth/verify-email    → Verifies with OTP          │
│  - POST /auth/resend-otp      → Resends OTP               │
│  - POST /auth/login           → Issues tokens              │
│  - POST /auth/refresh         → Rotates tokens             │
│  - POST /auth/logout          → Revokes tokens             │
│  - GET  /auth/me              → Gets user + workspaces     │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   MySQL Database                            │
├─────────────────────────────────────────────────────────────┤
│ Tables:                                                     │
│  - users                 (core user identity)              │
│  - email_otps           (OTP verification)                 │
│  - refresh_tokens       (session management)               │
│  - workspaces           (logical tenants)                  │
│  - workspace_members    (user-workspace-role mapping)      │
└─────────────────────────────────────────────────────────────┘
```

---

## User Registration Flow

### 1. User Registers

**Endpoint:** `POST /auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Password Requirements:**
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*)

**Backend Steps:**
1. ✅ Validate input (email format, password strength, name length)
2. ✅ Check if email already exists
3. ✅ Hash password with bcrypt (12 rounds)
4. ✅ Create **unverified** user in database
5. ✅ Generate 6-digit OTP
6. ✅ Hash OTP and store in `email_otps` table (expires in 10 minutes)
7. ✅ Send OTP email via Brevo
8. ✅ Create default workspace ("My Workspace")
9. ✅ Add user as OWNER of workspace

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "message": "Registration successful. Please verify your email to continue.",
    "nextStep": "verify-email"
  }
}
```

**Important:** User cannot login until email is verified.

---

### 2. Verify Email with OTP

**Endpoint:** `POST /auth/verify-email`

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "otpCode": "123456"
}
```

**Backend Steps:**
1. ✅ Fetch user and check they're not already verified
2. ✅ Get active OTP record
3. ✅ Validate OTP hasn't expired (10 minute window)
4. ✅ Check attempt limit (max 5 failed attempts)
5. ✅ Verify OTP code matches hash
6. ✅ Mark OTP as verified
7. ✅ Set `email_verified = true` on user
8. ✅ Generate access token (15m expiry)
9. ✅ Generate refresh token (30d expiry)
10. ✅ Store refresh token hash in database
11. ✅ Send welcome email
12. ✅ Set HTTP-only refresh token cookie

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "verified": true,
    "message": "Email verified successfully"
  }
}
```

**Cookie Set:**
```
refreshToken=<long-lived-token>; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

---

### 3. Resend OTP

**Endpoint:** `POST /auth/resend-otp`

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Backend Steps:**
1. ✅ Check user exists and not already verified
2. ✅ Delete previous unverified OTP records
3. ✅ Generate new 6-digit OTP
4. ✅ Hash and store with 10-minute expiry
5. ✅ Send via Brevo email

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent to your email",
    "email": "user@example.com"
  }
}
```

---

## Login Flow

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Backend Steps:**
1. ✅ Validate email format
2. ✅ Query user by email (case-insensitive)
3. ✅ **Check email_verified = true** (required!)
4. ✅ Check user status = "active"
5. ✅ Verify password hash
6. ✅ Generate access token (15m expiry)
7. ✅ Generate refresh token (30d expiry)
8. ✅ Store refresh token hash
9. ✅ Log successful login with IP + device info
10. ✅ Set HTTP-only refresh token cookie

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Error: Unverified Email**
```json
{
  "success": false,
  "error": {
    "message": "Please verify your email before logging in",
    "code": "EMAIL_NOT_VERIFIED",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Token Refresh Flow (With Rotation)

**Endpoint:** `POST /auth/refresh`

**Prerequisites:**
- Refresh token cookie must be valid
- Token must exist in database and not be revoked

**Backend Steps:**
1. ✅ Extract refresh token from cookie
2. ✅ Verify JWT signature (using JWT_REFRESH_SECRET)
3. ✅ Query database for token record
4. ✅ Check token is not revoked (revoked_at IS NULL)
5. ✅ Verify token hash matches
6. ✅ Check user is still active
7. ✅ **ROTATE TOKEN:**
   - Mark old token as revoked (`UPDATE ... SET revoked_at = NOW()`)
   - Generate new refresh token
   - Insert new token into database
8. ✅ Generate new access token
9. ✅ Set new refresh token cookie
10. ✅ Log token rotation

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Security Benefits:**
- ✅ Prevents token replay attacks (old token becomes invalid)
- ✅ Limits damage from compromised tokens
- ✅ Each refresh generates a new token pair
- ✅ Revoked tokens are tracked in database

---

## Logout Flow

**Endpoint:** `POST /auth/logout`

**Backend Steps:**
1. ✅ Get refresh token from cookie
2. ✅ Decode token to get user ID
3. ✅ Mark ALL refresh tokens as revoked (`UPDATE ... SET revoked_at = NOW()`)
4. ✅ Clear refresh token cookie
5. ✅ Log logout

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Client Steps:**
1. ✅ Discard access token from memory
2. ✅ Redirect to login page

---

## Get Current User

**Endpoint:** `GET /auth/me`

**Authentication:** Requires valid access token in `Authorization` header

**Request:**
```
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Backend Steps:**
1. ✅ Extract and verify access token
2. ✅ Fetch user details
3. ✅ Fetch user's workspaces and roles
4. ✅ Return complete user profile

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true,
      "status": "active",
      "createdAt": "2026-01-27T10:30:45.000Z"
    },
    "workspaces": [
      {
        "id": "workspace-uuid-1",
        "name": "My Workspace",
        "logoUrl": null,
        "role": "OWNER",
        "createdAt": "2026-01-27T10:30:45.000Z"
      }
    ]
  }
}
```

---

## JWT Access Token Structure

**Algorithm:** HS256 (HMAC SHA-256)

**Payload:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "USER",
  "type": "access",
  "iat": 1704988245,
  "exp": 1705489245
}
```

**Expiry:** 15 minutes (900 seconds)

**Storage:** Memory or secure storage (not localStorage for XSS protection)

---

## Database Schema

### users

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status)
);
```

### email_otps

```sql
CREATE TABLE email_otps (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  otp_code_hash VARCHAR(255) NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  device_name VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_revoked_at (revoked_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### workspaces

```sql
CREATE TABLE workspaces (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500) NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
```

### workspace_members

```sql
CREATE TABLE workspace_members (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('OWNER', 'ADMIN', 'USER') NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_workspace_user (workspace_id, user_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Permissions |
|------|-------------|
| **OWNER** | Full access (all operations, manage members, delete workspace) |
| **ADMIN** | Manage workspace settings, invite members, manage data |
| **USER** | Access data within workspace, basic operations |

### Authorization Middleware

```typescript
// Protect route to owners only
router.delete('/workspace/:workspaceId', authorize(['OWNER']), deleteWorkspaceController);

// Protect route to admins and owners
router.put('/workspace/:workspaceId/settings', authorize(['OWNER', 'ADMIN']), updateSettingsController);

// Protect route to all members
router.get('/workspace/:workspaceId/data', authorize(['OWNER', 'ADMIN', 'USER']), getDataController);
```

---

## Configuration

All auth settings are centralized in `src/config/auth.ts`:

```typescript
export const auth = {
  // Token expiry times
  accessTokenExpiry: '15m',           // 15 minutes
  refreshTokenExpiry: '30d',          // 30 days
  
  // OTP Configuration
  otp: {
    length: 6,                        // 6-digit code
    expiryMinutes: 10,                // Expires in 10 minutes
    maxAttempts: 5                    // Max 5 failed attempts
  },
  
  // Cookie settings
  cookies: {
    refreshTokenName: 'refreshToken',
    httpOnly: true,                   // Prevent JS access
    secure: true,                     // HTTPS only in prod
    sameSite: 'strict',               // CSRF protection
    maxAge: 2592000000                // 30 days in milliseconds
  },
  
  // Rate limiting (per 15 minutes)
  rateLimiting: {
    authWindowMs: 900000,             // 15 minutes
    authMaxRequests: 5,               // Max 5 requests
    otpWindowMs: 300000,              // 5 minutes
    otpMaxRequests: 3                 // Max 3 OTP requests
  }
};
```

---

## Environment Variables

```env
# JWT Secrets (change in production!)
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production

# Brevo Email Configuration
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=noreply@easystack.io
BREVO_SENDER_NAME=EasyStack

# Password hashing
BCRYPT_ROUNDS=12

# OTP Configuration
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5

# Node environment
NODE_ENV=production
```

---

## Security Best Practices

### ✅ Implemented

1. **Password Security**
   - Bcrypt hashing with 12 rounds
   - Strong password requirements (12+ chars, mixed case, numbers, special chars)
   - Never logged or exposed

2. **Token Security**
   - Access tokens short-lived (15 minutes)
   - Refresh tokens long-lived but rotated
   - Tokens hashed before storage
   - Revocation tracking in database

3. **Cookie Security**
   - HTTP-only flag prevents JavaScript access
   - Secure flag (HTTPS only in production)
   - SameSite=Strict prevents CSRF attacks
   - Automatic clearance on logout

4. **Rate Limiting**
   - Auth endpoints limited to 5 requests per 15 minutes
   - OTP endpoints limited to 3 requests per 5 minutes
   - Prevents brute force attacks

5. **OTP Security**
   - 6-digit codes
   - Hashed in database
   - 10-minute expiration
   - Maximum 5 failed attempts

6. **Session Tracking**
   - IP address logged with each token
   - User agent/device name tracked
   - Revocation supported for security incidents
   - Token rotation prevents replay attacks

7. **Data Protection**
   - Email verified before login allowed
   - User status checked on every operation
   - Workspace access controlled by role
   - SQL injection prevented via parameterized queries

### 🔒 Additional Recommendations

For production deployment:

1. **Enable HTTPS/TLS** (required for secure cookies)
2. **Use strong JWT secrets** (randomly generated, 32+ characters)
3. **Configure Brevo API key** in secure secret manager
4. **Enable CORS** with specific whitelisted domains
5. **Monitor failed login attempts** for suspicious activity
6. **Implement IP-based rate limiting** at infrastructure level
7. **Use database encryption** at rest
8. **Enable audit logging** for all auth events
9. **Set up alerts** for unusual patterns (multiple failed logins, etc.)
10. **Rotate JWT secrets periodically** (with fallback support)

---

## Testing Authentication

### Register Flow
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Verify Email
```bash
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "otpCode": "123456"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Refresh Token
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=..."
```

### Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: refreshToken=..."
```

---

## Troubleshooting

### Email Not Received
- Check Brevo API key is configured
- Verify email address is correct
- Check Brevo account has credits/no sending limits
- Review email logs in Brevo dashboard

### OTP Expired
- User has 10 minutes to use OTP
- Use `/auth/resend-otp` to get a new code
- Old OTP is automatically invalidated

### Token Rotation Issues
- Old token is revoked after refresh
- Token must exist in database with `revoked_at IS NULL`
- Check `refresh_tokens` table for revocation status

### Access Denied to Workspace
- User must be member of workspace
- Check `workspace_members` table for user-workspace mapping
- Verify role is sufficient for operation

### Email Verification Required
- Error: "Please verify your email before logging in"
- User must first complete `/auth/verify-email`
- Check `users.email_verified` field

---

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Social login (Google, GitHub)
- [ ] Magic links as alternative to OTP
- [ ] Password reset flow
- [ ] Account recovery
- [ ] Session management dashboard
- [ ] Device trust/remember this device
- [ ] Audit log dashboard
- [ ] API tokens for service-to-service auth
- [ ] OAuth2 provider for third-party integrations

