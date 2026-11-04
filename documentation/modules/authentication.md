# Authentication & Identity Module

## 1. Purpose & Responsibilities

The **Authentication & Identity Module** manages user onboarding, credential validation, email verification via one-time passwords (OTP), session lifecycle management, JWT issuance and rotation, and third-party OAuth provider authentication (Google Sign-In).

### Core Responsibilities
- Account registration with pending email verification.
- Ephemeral 6-digit OTP generation, hashing, and rate-limited verification stored in Redis.
- Password hashing and verification using `bcrypt`.
- Google OAuth token validation via Google Identity Services and account linking.
- Issuance and rotation of short-lived JWT access tokens (15m) and persistent refresh tokens (7d) in `HttpOnly` cookies.
- Automatic provisioning of a personal default workspace upon user email verification or Google sign-in.
- Session listing and revocation.

---

## 2. File Responsibility Map

```text
src/
├── routes/auth/
│   ├── auth.routes.ts                  # Route definitions, rate limiting, and middleware wiring
│   ├── register.controller.ts          # POST /api/auth/register
│   ├── verify-email.controller.ts      # POST /api/auth/verify-email
│   ├── resend-otp.controller.ts        # POST /api/auth/resend-otp
│   ├── login.controller.ts             # POST /api/auth/login
│   ├── provider.controller.ts         # POST /api/auth/providers/google (OAuth verification & linking)
│   ├── refresh.controller.ts           # POST /api/auth/refresh (JWT cookie rotation)
│   ├── logout.controller.ts            # POST /api/auth/logout (Session revocation)
│   ├── me.controller.ts                # GET /api/auth/me (Current user & accessible workspaces)
│   ├── forgot-password.controller.ts   # POST /api/auth/forgot-password (Dispatch reset email)
│   ├── reset-password.controller.ts    # POST /api/auth/reset-password (Validate token and update hash)
│   └── sessions.controller.ts          # GET/DELETE /api/auth/sessions (Multi-device management)
│
├── services/authentication/
│   ├── authentication.module.ts        # Composition root wiring repositories, caches, and services
│   ├── authentication.service.ts       # Primary facade orchestrating auth flows
│   ├── services/
│   │   ├── account-provisioning.service.ts # Creates default workspace, roles & sets defaultWorkspaceId
│   │   ├── authentication-validation.service.ts # Input validation (email, password complexity)
│   │   ├── email-verification.service.ts   # OTP generation, storage, and verification
│   │   ├── password-reset.service.ts       # Token generation, Redis caching, password update
│   │   ├── session.service.ts              # Session persistence in MySQL, refresh token tracking
│   │   └── token.service.ts                # Signs/verifies JWT access and refresh tokens
│   ├── cache/
│   │   ├── email-verification.cache.ts     # Redis keys: email_otp:<userId>, email_verification:<token>
│   │   └── password-reset.cache.ts         # Redis key: password_reset:<token>
│   ├── providers/
│   │   ├── google-auth.provider.ts         # Google OAuth ID token verification (google-auth-library)
│   │   └── provider.registry.ts            # Provider lookup registry
│   ├── repositories/
│   │   ├── authentication.repository.ts    # Prisma User and AuthAccount queries
│   │   ├── session.repository.ts           # Prisma Session & RefreshToken management
│   │   └── account-provisioning.repository.ts # Transactional workspace + owner role provisioning
│   ├── middleware/express/
│   │   └── authentication.middleware.ts    # authenticate middleware verifying Bearer/cookie token
│   └── adapters/
│       └── bullmq-authentication.notifier.ts # Enqueues email jobs to BullMQ email queue
```

---

## 3. Public Interfaces & Key Methods

### `AuthenticationService` ([`src/services/authentication/authentication.service.ts`](file:///home/eteknas/Projects/easystack-backend/src/services/authentication/authentication.service.ts))
- `register(input)`: Validates credentials, creates unverified `User` in MySQL, generates 6-digit OTP in Redis, enqueues verification email in BullMQ.
- `verifyEmail(token, otp)`: Checks Redis OTP. If valid, marks user verified, provisions default workspace, issues JWT session.
- `login(input)`: Verifies password against `AuthAccount.passwordHash`. Issues access & refresh token cookies.
- `authenticateWithProvider(providerName, token)`: Verifies third-party ID token (Google), resolves or creates user, provisions default workspace if new, returns session cookies.
- `refreshToken(refreshToken)`: Validates refresh token in MySQL `Session`, rotates refresh token, issues new access token.
- `logout(userId, sessionId)`: Marks session revoked in MySQL and clears client cookies.

### `authenticate` Middleware ([`src/services/authentication/middleware/express/authentication.middleware.ts`](file:///home/eteknas/Projects/easystack-backend/src/services/authentication/middleware/express/authentication.middleware.ts))
- Extracts token from `Authorization: Bearer <token>` or `accessToken` cookie.
- Verifies signature using `config.auth.jwtSecret`.
- Attaches authenticated user payload to `req.user`:
  ```typescript
  req.user = { id: string, email: string, defaultWorkspaceId?: string };
  ```
- Rejects unauthenticated requests with `401 Unauthorized` (`UNAUTHORIZED` error code).

---

## 4. Dependencies & Data Flow

1. **Storage**:
   - **MySQL (Prisma)**: Persists `User`, `AuthAccount`, `Session`, and `RefreshToken`.
   - **Redis**: Stores ephemeral OTP hashes (`email_otp:<userId>`, 15m TTL) and reset tokens (`password_reset:<token>`, 1h TTL).
2. **Background Jobs**:
   - `BullMqAuthenticationNotifier` dispatches `send-otp-email`, `send-welcome-email`, and `send-password-reset-email` to the BullMQ `email` queue.
3. **Workspace Provisioning**:
   - Automatically invokes `AccountProvisioningService` on verification to generate a "Personal Workspace" with `WORKSPACE_OWNER` role.
