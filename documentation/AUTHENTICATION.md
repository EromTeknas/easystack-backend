# Authentication System Design

Production-ready authentication system for EasyStack Backend with Next.js frontend integration.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Next.js Frontend                        │
│  • Access token in HttpOnly cookie                              │
│  • Refresh token in HttpOnly cookie                             │
│  • Auto-rotate on /auth/me when access expires                  │
└──────────────────────────────────────┬──────────────────────────┘
                                       │
                                       │ HTTP/HTTPS
                                       │
┌──────────────────────────────────────▼──────────────────────────┐
│                      Express Backend                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Authentication Routes (/auth)                          │    │
│  │ • POST /register - Create new account                 │    │
│  │ • POST /login - Issue auth cookies                    │    │
│  │ • POST /refresh - Rotate cookies                      │    │
│  │ • POST /logout - Revoke refresh token                 │    │
│  │ • GET /me - Get current user                          │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Middleware                                              │    │
│  │ • authenticateToken - Verify access token             │    │
│  │ • authorize - Check role-based permissions            │    │
│  │ • rateLimiter - Limit auth endpoint requests          │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────┬──────────────────────────┘
                                       │
                                       │ Database Queries
                                       │
┌──────────────────────────────────────▼──────────────────────────┐
│                         MySQL Database                          │
│  • users table - User profile & account state                   │
│  • auth_accounts table - Password/OAuth provider identities     │
│  • refresh_tokens table - Valid tokens & revocation status      │
│  • audit_logs table (optional) - Login attempts                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Updated Auth & Recovery Flow (Redis + Workers)

> This section reflects the current implementation: OTPs and password reset tokens are stored **only in Redis**, and all emails (OTP, welcome, password reset) are sent via **BullMQ workers**.

```mermaid
flowchart TD
  subgraph Client
    FE[Next.js Frontend]
  end

  subgraph Backend[Express Backend]
    REG[/POST /auth/register/]
    VER[/POST /auth/verify-email/]
    LOGIN[/POST /auth/login/]
    FP[/POST /auth/forgot-password/]
    RP[/POST /auth/reset-password/]
  end

  subgraph Redis[Redis]
    OTP[(email_otp:<userId>)]
    PR[(password_reset:<token>)]
  end

  subgraph Queues[BullMQ Queues]
    QE[email]
  end

  subgraph Worker[Worker Process]
    W[Email Worker Group\n(worker:email)]
  end

  subgraph DB[MySQL]
    U[(users)]
    RT[(refresh_tokens)]
    WS[(workspaces)]
    WM[(workspace_members)]
  end

  FE --> REG
  REG -->|create or update\nPENDING_VERIFICATION user| U
  REG -->|store hashed OTP| OTP
  REG -->|enqueue SEND_OTP_EMAIL| QE

  QE --> W -->|send transactional email| FE

  FE --> VER
  VER -->|lookup & verify OTP| OTP
  VER -->|mark email_verified=TRUE,\nstatus=ACTIVE| U
  VER -->|ensure default workspace\n& OWNER membership| WS
  VER -->|insert refresh token hash| RT
  VER -->|enqueue SEND_WELCOME_EMAIL| QE

  FE --> LOGIN
  LOGIN -->|validate credentials, status=ACTIVE,\nemail_verified=TRUE| U
  LOGIN -->|issue tokens & store refresh| RT

  FE --> FP
  FP -->|if unverified: regenerate OTP,\nstore in Redis, enqueue OTP email| OTP
  FP -->|if verified: create reset token,\nstore hashed in Redis, enqueue reset email| PR
  FP --> QE

  FE --> RP
  RP -->|verify & consume reset token| PR
  RP -->|update password, revoke refresh tokens| U
  RP --> RT
```

---

## Token Flow Diagrams

### 1. Registration & Email Verification Flow

```
Client                          Backend                      Database
  │                              │                               │
  ├─ POST /auth/register ───────→ │                               │
  │  {email, password, names}    │                               │
  │                              ├─ Validate input              │
  │                              │  ├─ Check email format       │
  │                              │  ├─ Check password strength  │
  │                              │  └─ Check email unique ──────→ │
  │                              │                              │
  │                              │ ←─ User doesn't exist ───────┤
  │                              │                               │
  │                              ├─ Hash password               │
  │                              │  (bcrypt, 12 rounds)          │
  │                              │                               │
  │                              ├─ Create user record ─────────→ │
  │                              │  (email_verified = FALSE)     │
  │                              │                              │
  │                              │ ←─ User created ──────────────┤
  │                              │                               │
  │                              ├─ Generate OTP (6 digits)     │
  │                              │  ├─ Hash OTP                 │
  │                              │  └─ Set 10 min expiry ──────→ │
  │                              │     (store in DB)             │
  │                              │                              │
  │                              ├─ Send OTP via email          │
  │                              │  (async, doesn't block)       │
  │                              │                               │
  │ ←─ 201 Created ────────────  │                               │
  │  Body: {userId, email, names} │                               │
  │  (NO accessToken)            │                               │
  │                              │                               │
  │ User receives email with OTP  │                               │
  │                              │                               │
  ├─ POST /auth/verify-email ───→ │                               │
  │  {userId, otpCode}           │                               │
  │                              ├─ Validate OTP                │
  │                              ├─ Query OTP record ───────────→ │
  │                              │                              │
  │                              │ ←─ OTP data ──────────────────┤
  │                              │                               │
  │                              ├─ Check expiration            │
  │                              │  └─ Verify hash               │
  │                              │                               │
  │                              ├─ Generate tokens             │
  │                              │  • access: 15 min            │
  │                              │  • refresh: 7 days           │
  │                              │                               │
  │                              ├─ Hash refresh token ─────────→
  │                              │  (save in DB)                 │
  │                              │                               │
  │                              ├─ Mark email verified ────────→
  │                              │  (UPDATE users)               │
  │                              │                              │
  │                              ├─ Send welcome email           │
  │                              │                               │
  │ ←─ 200 OK ─────────────────  │                               │
  │  Body: {user, verified}      │                               │
  │  Cookie: accessToken, refreshToken │                         │
  │
```

### 2. Initial Login Flow

```
Client                          Backend                      Database
  │                              │                               │
  ├─ POST /auth/login ──────────→ │                               │
  │  {email, password}           │                               │
  │                              ├─ Query user by email ────────→ │
  │                              │                              │
  │                              │ ←─ User data ────────────────┤
  │                              │                               │
  │                              ├─ Check email verified        │
  │                              │                               │
  │                              ├─ bcrypt.compare() ────────── │
  │                              │  (verify password)            │
  │                              │                               │
  │                              ├─ Generate tokens             │
  │                              │  • access: 15 min            │
  │                              │  • refresh: 7 days           │
  │                              │                               │
  │                              ├─ Hash refresh token ─────────→
  │                              │  (save in DB)                 │
  │                              │                              │
  │ ←─ 200 OK ─────────────────  │                               │
  │  Body: {user}                │                               │
  │  Cookie: accessToken, refreshToken │                         │
  │
```

### 3. Authenticated Request Flow

```
Client                          Backend                      Database
  │                              │                               │
  ├─ GET /api/users ───────────→ │                               │
  │  Cookie: accessToken         │                               │
  │                              ├─ authenticateToken()         │
  │                              │  • Verify JWT signature       │
  │                              │  • Check expiration           │
  │                              │  • Extract user info          │
  │                              │                               │
  │                              ├─ authorize('ADMIN') ─────────→ │
  │                              │  (check role in token)       │
  │                              │                              │
  │                              ├─ Process request             │
  │ ←─ 200 OK ─────────────────  │                               │
  │
```

### 4. Token Refresh Flow

```
Client                          Backend                      Database
  │                              │                               │
  │  [Access Token Expired]      │                               │
  │                              │                               │
  ├─ GET /api/users ───────────→ │                               │
  │  Cookie: accessToken         │                               │
  │                              ├─ authenticateToken()         │
  │                              │  ❌ Token expired             │
  │                              │                               │
  │ ←─ 401 Unauthorized ────────  │                               │
  │                              │                               │
  │  [Frontend handles 401]      │                               │
  │                              │                               │
  ├─ POST /auth/refresh ────────→ │                               │
  │  Cookie: refreshToken=...    │                               │
  │                              ├─ Get refreshToken cookie     │
  │                              │                               │
  │                              ├─ Verify JWT signature ──────→ │
  │                              │                              │
  │                              ├─ Query DB for token ────────→ │
  │                              │  (check if revoked)          │
  │                              │                              │
  │                              │ ←─ Token record ─────────────┤
  │                              │                               │
  │                              ├─ If valid:                   │
  │                              │  • Rotate refresh token      │
  │                              │  • Issue new access token    │
  │                              │  • Update refresh token DB   │
  │                              │                               │
  │ ←─ 200 OK ─────────────────  │                               │
  │  Body: {user}                │                               │
  │  Cookie: accessToken, refreshToken (new)                    │
  │                              │                               │
  │  [Frontend continues with cookies]                          │
  │                              │                               │
  ├─ GET /api/users ───────────→ │                               │
  │  Cookie: accessToken         │                               │
  │                              ├─ Process request ────────────→ │
  │ ←─ 200 OK ─────────────────  │                               │
  │
```

### 5. Logout Flow

```
Client                          Backend                      Database
  │                              │                               │
  ├─ POST /auth/logout ────────→ │                               │
  │  Cookie: refreshToken=...    │                               │
  │                              ├─ Get refreshToken cookie     │
  │                              │                               │
  │                              ├─ Mark token as revoked ─────→ │
  │                              │  (UPDATE refresh_tokens)      │
  │                              │                              │
  │                              │ ←─ Updated ────────────────┤
  │                              │                               │
  │                              ├─ Clear Cookie                │
  │ ←─ 200 OK ─────────────────  │                               │
  │                              │                               │
  │  [Frontend clears memory]    │                               │
  │
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'EXPIRED') DEFAULT 'PENDING_VERIFICATION',
  email_verified BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  default_workspace_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email),
  INDEX idx_status (status)
);
```

### Auth Accounts Table

```sql
CREATE TABLE auth_accounts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  provider ENUM('PASSWORD', 'GOOGLE', 'MICROSOFT', 'GITHUB') NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255) NULL,
  metadata JSON NULL,
  last_used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_provider_account (provider, provider_account_id),
  UNIQUE KEY uk_user_provider (user_id, provider),
  INDEX idx_email (email)
);
```

### Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  rotated_token_hash VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_revoked_at (revoked_at)
);
```

### Audit Logs Table (Optional)

```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  action VARCHAR(50),
  resource VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  status ENUM('success', 'failure'),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);
```

---

## API Endpoints

### Post-Authentication Redirects

Auth endpoints accept an optional `redirectUrl` in the JSON body or query string. The backend validates it and returns a safe app-relative path for the frontend to navigate to after authentication.

Supported endpoints:

- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/login`
- `POST /auth/providers/google`

Example:

```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "redirectUrl": "/projects/my-project"
}
```

Successful response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "john@example.com"
    },
    "redirectUrl": "/projects/my-project"
  }
}
```

Redirect safety rules:

- Relative app paths are allowed, for example `/projects/my-project`.
- Empty or missing values default to `/dashboard`.
- Protocol-relative URLs such as `//evil.example` are rejected.
- External absolute URLs are rejected unless their origin is configured in `CORS_ORIGIN`, `FRONTEND_URL`, or `APP_FRONTEND_URL`.
- Allowed absolute URLs are normalized back to app-relative paths before being returned.

Frontend flow:

```ts
const redirectUrl = window.location.pathname + window.location.search;

router.push(`/login?redirectUrl=${encodeURIComponent(redirectUrl)}`);
```

Then on login:

```ts
const response = await fetch("/api/auth/login", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, redirectUrl }),
});

const body = await response.json();
router.push(body.data.redirectUrl);
```

### 1. POST /auth/register

**Purpose**: Create a new user account, send OTP for email verification, and issue a short-lived verification token for API-based email verification.

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Validation**:
- Email must be valid format
- Email must be unique
- Password must be ≥12 characters with uppercase, lowercase, number, symbol
- Names must be ≤100 characters

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "email": "john@example.com",
    "verificationToken": "4a2f9c0b8e1d4f01b3c5a7d9e2f4c6a8"
  }
}
```

**Notes**:
- No access token is returned at registration
- OTP is still sent to the provided email address for email-based flows
- A short-lived `verificationToken` is also created and stored in Redis and can be used by the frontend to call `/auth/verify-email` without exposing `userId`
- User must verify email (via verificationToken + OTP) before login
- A default workspace is created for the user

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_EMAIL",
    "message": "Email is not valid"
  }
}
```

**Response (409 Conflict)**:
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_EXISTS",
    "message": "Email already registered"
  }
}
```

---

### 2. POST /auth/verify-email

**Purpose**: Verify user's email using the short-lived verification token plus the OTP code and grant access

**Request**:
```json
{
  "verificationToken": "4a2f9c0b8e1d4f01b3c5a7d9e2f4c6a8",
  "otpCode": "123456"
}
```

**Validation**:
- verificationToken must be a non-empty string
- otpCode must be a non-empty string
- A corresponding Redis key must exist: `email_verification:<verificationToken>`
- The Redis record must contain a `purpose` of `EMAIL_VERIFICATION`
- The stored `otpHash` must match the provided `otpCode`
- The key must not be expired (short-lived TTL, aligned with OTP expiry configuration)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "verified": true,
    "message": "Email verified successfully"
  }
}
```

**Notes**:
- Access and refresh tokens are set as HttpOnly cookies
- Email is marked as verified in the database
- User can now login with email/password
- Welcome email is sent to user

**Cookies Set**:
```
Set-Cookie: accessToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=900
Set-Cookie: refreshToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

**Response (401 Unauthorized)** (invalid or expired verification code):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired verification code"
  }
}
```

**Response (401 Unauthorized)** (too many attempts):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Too many failed attempts. Please request a new OTP."
  }
}
```

**Response (404 Not Found)** (user not found):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

---

### 3. POST /auth/resend-otp

**Purpose**: Resend OTP code to user's email using an existing verification token

**Request**:
```json
{
  "verificationToken": "4a2f9c0b8e1d4f01b3c5a7d9e2f4c6a8"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "email": "john@example.com"
  }
}
```

**Notes**:
- Regenerates and updates the OTP hash in the existing verification record in Redis
- Sends a new 6-digit code via email
- New OTP is valid for 10 minutes (TTL is refreshed when OTP is regenerated)

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

**Response (400 Bad Request)** (already verified):
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Email already verified"
  }
}
```

---

### 4. POST /auth/login

**Purpose**: Authenticate user with verified email and password

**Requirements**:
- Email must be verified (via OTP)
- Password must be correct

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER"
    }
  }
}
```

**Cookies Set**:
```
Set-Cookie: accessToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=900
Set-Cookie: refreshToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

**Response (401 Unauthorized)**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

**Response (403 Forbidden)** (email not verified):
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Email not verified. Please verify your email first."
  }
}
```

**Response (429 Too Many Requests)** (rate limited):
```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many login attempts. Try again later."
  }
}
```

---

### 5. POST /auth/refresh

**Purpose**: Rotate refresh token and issue new access token cookie

**Request**:
```
Headers:
  Cookie: refreshToken=<jwt>
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER"
    },
    "message": "Tokens refreshed"
  }
}
```

**Response (401 Unauthorized)** (refresh token expired or revoked):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Please login again"
  }
}
```

**Cookies Set** (if token rotated):
```
Set-Cookie: accessToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=900
Set-Cookie: refreshToken=<newJwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

### 6. POST /auth/logout

**Purpose**: Invalidate the user session

**Request**:
```
Headers:
  Cookie: refreshToken=<jwt>
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Cookies Cleared**:
```
Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
Set-Cookie: accessToken=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
```

---

### 7. GET /auth/me

**Purpose**: Get current authenticated user

**Request**:
```
Headers:
  Cookie: accessToken=<jwt>
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "emailVerified": true,
      "lastLoginAt": "2026-01-26T10:30:00Z"
    }
  }
}
```

**Response (401 Unauthorized)** (no token):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No token provided"
  }
}
```

---

## JWT Token Structure

### Access Token (15 minutes)

```typescript
{
  // Header
  {
    "alg": "HS256",
    "typ": "JWT"
  }

  // Payload
  {
    "sub": "1",                    // User ID
    "email": "john@example.com",   // User email
    "role": "USER",                // User role
    "iat": 1643184200,             // Issued at
    "exp": 1643185100,             // Expires in 15 minutes
    "type": "access"               // Token type
  }

  // Signature (HMAC SHA-256)
  HMACSHA256(
    base64UrlEncode(header) + "." +
    base64UrlEncode(payload),
    SECRET_KEY
  )
}
```

### Refresh Token (7 days)

```typescript
{
  // Header
  {
    "alg": "HS256",
    "typ": "JWT"
  }

  // Payload
  {
    "sub": "1",                    // User ID
    "jti": "uuid-random-string",   // Token ID (for revocation)
    "iat": 1643184200,             // Issued at
    "exp": 1643788200,             // Expires in 7 days
    "type": "refresh"              // Token type
  }

  // Signature
  HMACSHA256(
    base64UrlEncode(header) + "." +
    base64UrlEncode(payload),
    REFRESH_SECRET_KEY
  )
}
```

---

## Security Implementation

### Password Hashing

```typescript
// Using bcrypt with salt rounds = 12
import bcrypt from 'bcrypt';

// During registration/password change
const hash = await bcrypt.hash(password, 12);
// Store hash in database

// During login
const isValid = await bcrypt.compare(password, storedHash);
```

### Token Generation & Validation

```typescript
// Using jsonwebtoken library
import jwt from 'jsonwebtoken';

// Generate access token
const accessToken = jwt.sign(
  { sub: user.id, email: user.email, role: user.role, type: 'access' },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);

// Generate refresh token
const refreshToken = jwt.sign(
  { sub: user.id, jti: randomUUID(), type: 'refresh' },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Refresh Token Storage

```typescript
// Hash the JWT before storing
const tokenHash = await bcrypt.hash(refreshToken, 12);

// Store in database
await db.query(
  'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
  [userId, tokenHash, expiresAt]
);

// On validation, compare JWT with stored hash
const token = await db.query(
  'SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL',
  [userId]
);
const isValid = await bcrypt.compare(refreshToken, token.token_hash);
```

### Cookie Configuration

```typescript
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,      // Not accessible via JavaScript
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days in milliseconds
});
```

### Rate Limiting

```typescript
// Limit login/register to 5 requests per 15 minutes per IP
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 5,                     // 5 requests
  message: 'Too many attempts',
  standardHeaders: true,      // Return rate limit info
  legacyHeaders: false
});

app.post('/auth/login', authLimiter, loginController);
app.post('/auth/register', authLimiter, registerController);
```

---

## Middleware Implementation

### Authentication Middleware

```typescript
// Verify access token from Authorization header
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      throw new UnauthorizedError('Invalid token type');
    }

    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
};
```

### Authorization Middleware

```typescript
// Check if user has required role
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};

// Usage:
app.delete('/users/:id', authenticateToken, authorize('ADMIN'), deleteUserController);
```

---

## Environment Variables

```env
# JWT Secrets
JWT_SECRET=your-super-secret-key-min-32-chars-long!!!
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars-long!!!

# Token Expiration
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Password Hashing
BCRYPT_ROUNDS=12

# Security
NODE_ENV=production
CORS_ORIGIN=https://yourfrontend.com
```

---

## Frontend Integration

### Session Management Setup

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState(null);

  // Store in memory only (never localStorage)
  const login = async (email, password) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'include',  // Include auth cookies
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    setUser(data.data.user);
  };

  const logout = async () => {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setUser(null);
  };

  const refresh = async () => {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (!res.ok) logout();
  };

  return { user, login, logout, refresh };
};
```

### API Request Interceptor

```typescript
// utils/api.ts
export const createApiClient = () => {
  return {
    async request(url, options = {}) {
      let response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers
        }
      });

      // Handle token expiration
      if (response.status === 401) {
        const refreshResponse = await fetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });

        if (refreshResponse.ok) {
          // Retry request with updated cookies
          response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              ...options.headers
            }
          });
        } else {
          // Refresh failed, redirect to login
          window.location.href = '/login';
        }
      }

      return response;
    }
  };
};
```

---

## Multi-Device Support

### Device Tracking

```sql
-- Enhanced refresh_tokens table with device info
device_name VARCHAR(255),       -- e.g., "Chrome on Windows"
ip_address VARCHAR(45),
user_agent TEXT,

-- Allow user to manage sessions
SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL;

-- Revoke specific device
UPDATE refresh_tokens SET revoked_at = NOW()
WHERE user_id = ? AND device_name = ?;
```

---

## Testing Strategy

### Unit Tests

```typescript
// test/auth.test.ts

describe('Authentication', () => {
  describe('Register', () => {
    it('should create a new user with valid data', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          first_name: 'Test',
          last_name: 'User'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject duplicate emails', async () => {
      // Register first user
      await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'ValidPassword123!' });

      // Try duplicate
      const response = await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'ValidPassword123!' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('Login', () => {
    it('should set auth cookies on valid credentials', async () => {
      // Setup user
      await User.create({
        email: 'test@example.com',
        password: await bcrypt.hash('ValidPassword123!', 12)
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });
});
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Install dependencies (jsonwebtoken, bcrypt, express-rate-limit)
- [ ] Create database schema (users, refresh_tokens)
- [ ] Create User model
- [ ] Create RefreshToken model

### Phase 2: Core Authentication
- [ ] Implement password hashing utility
- [ ] Implement token generation utility
- [ ] Create register endpoint
- [ ] Create login endpoint
- [ ] Create refresh endpoint

### Phase 3: Session Management
- [ ] Create logout endpoint
- [ ] Create /auth/me endpoint
- [ ] Implement authentication middleware
- [ ] Implement authorization middleware

### Phase 4: Security
- [ ] Add rate limiting
- [ ] Add password validation
- [ ] Add CORS configuration
- [ ] Add helmet security headers

### Phase 5: Testing & Documentation
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Create API documentation
- [ ] Document frontend integration

---

## Security Checklist

✅ **Access Token**: Short-lived (15 min), stored in memory  
✅ **Refresh Token**: Long-lived (7 days), HttpOnly cookie  
✅ **Password**: Hashed with bcrypt (12 rounds)  
✅ **Tokens**: Signed with strong secret keys  
✅ **Refresh Token Hash**: Stored in database, never plain text  
✅ **Rate Limiting**: Applied to auth endpoints  
✅ **Secrets**: All in environment variables  
✅ **CORS**: Configured to frontend origin only  
✅ **Cookies**: HttpOnly, Secure, SameSite=Strict  
✅ **Validation**: Input validation on all endpoints  
✅ **Errors**: Generic error messages (no info leakage)  
✅ **Audit**: Optional logging of auth attempts  

---

## Future Enhancements

1. **Email Verification**: Send verification link on registration
2. **Password Reset**: Secure password reset via email
3. **Two-Factor Authentication**: SMS or authenticator app
4. **Social Login**: OAuth with GitHub, Google, etc.
5. **API Tokens**: Static tokens for programmatic access
6. **Session Management**: User dashboard to manage devices
7. **Suspicious Activity**: Alert on unusual login patterns
8. **IP Whitelisting**: Optional trusted device management

---

[← Back to Project](../README.md)
