# Authentication System Design

Production-ready authentication system for EasyStack Backend with Next.js frontend integration.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Next.js Frontend                        │
│  • Access token in memory                                        │
│  • Refresh token in HttpOnly cookie (read-only)                 │
│  • Auto-refresh on 401                                          │
└──────────────────────────────────────┬──────────────────────────┘
                                       │
                                       │ HTTP/HTTPS
                                       │
┌──────────────────────────────────────▼──────────────────────────┐
│                      Express Backend                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Authentication Routes (/auth)                          │    │
│  │ • POST /register - Create new account                 │    │
│  │ • POST /login - Issue tokens                          │    │
│  │ • POST /refresh - Renew access token                  │    │
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
│  • users table - User accounts & credentials                    │
│  • refresh_tokens table - Valid tokens & revocation status      │
│  • audit_logs table (optional) - Login attempts                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Token Flow Diagrams

### 1. Initial Login Flow

```
Client                          Backend                      Database
  │                              │                               │
  ├─ POST /auth/login ────────→  │                               │
  │  {email, password}           │                               │
  │                              ├─ Query user by email ────────→ │
  │                              │                              │
  │                              │ ←─ User data ────────────────┤
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
  │  Body: {accessToken, user}   │                               │
  │  Cookie: refreshToken=...    │                               │
  │
```

### 2. Authenticated Request Flow

```
Client                          Backend                      Database
  │                              │                               │
  ├─ GET /api/users ───────────→ │                               │
  │  Header: Authorization:      │                               │
  │  Bearer <accessToken>        │                               │
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

### 3. Token Refresh Flow

```
Client                          Backend                      Database
  │                              │                               │
  │  [Access Token Expired]      │                               │
  │                              │                               │
  ├─ GET /api/users ───────────→ │                               │
  │  Header: Authorization:      │                               │
  │  Bearer <accessToken>        │                               │
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
  │                              │  • Rotate token (optional)   │
  │                              │  • Issue new access token    │
  │                              │  • Update refresh token DB   │
  │                              │                               │
  │ ←─ 200 OK ─────────────────  │                               │
  │  Body: {accessToken, user}   │                               │
  │  Cookie: refreshToken=...(new)                              │
  │                              │                               │
  │  [Frontend stores new token] │                               │
  │                              │                               │
  ├─ GET /api/users ───────────→ │                               │
  │  Header: Authorization:      │                               │
  │  Bearer <newAccessToken>     │                               │
  │                              ├─ Process request ────────────→ │
  │ ←─ 200 OK ─────────────────  │                               │
  │
```

### 4. Logout Flow

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
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('USER', 'ADMIN', 'MODERATOR') DEFAULT 'USER',
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
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

### 1. POST /auth/register

**Purpose**: Create a new user account

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe"
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
    "user": {
      "id": 1,
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "USER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

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

**Cookies Set**:
```
Set-Cookie: refreshToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

### 2. POST /auth/login

**Purpose**: Authenticate user and establish session

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
      "id": 1,
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "USER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Response (401 Unauthorized)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
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

**Cookies Set**:
```
Set-Cookie: refreshToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

### 3. POST /auth/refresh

**Purpose**: Obtain new access token without re-authentication

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
      "id": 1,
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "USER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Response (401 Unauthorized)** (refresh token expired or revoked):
```json
{
  "success": false,
  "error": {
    "code": "REFRESH_TOKEN_INVALID",
    "message": "Please login again"
  }
}
```

**Cookies Set** (if token rotated):
```
Set-Cookie: refreshToken=<newJwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

### 4. POST /auth/logout

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
```

---

### 5. GET /auth/me

**Purpose**: Get current authenticated user

**Request**:
```
Headers:
  Authorization: Bearer <accessToken>
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "USER",
      "email_verified": true,
      "last_login_at": "2026-01-26T10:30:00Z"
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
  const [accessToken, setAccessToken] = useState(null);

  // Store in memory only (never localStorage)
  const login = async (email, password) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'include',  // Include refresh cookie
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
  };

  const logout = async () => {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setAccessToken(null);
    setUser(null);
  };

  const refresh = async () => {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
    } else {
      logout();
    }
  };

  return { user, accessToken, login, logout, refresh };
};
```

### API Request Interceptor

```typescript
// utils/api.ts
export const createApiClient = (getAccessToken) => {
  return {
    async request(url, options = {}) {
      const token = getAccessToken();
      
      let response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      });

      // Handle token expiration
      if (response.status === 401) {
        const refreshResponse = await fetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });

        if (refreshResponse.ok) {
          const { data } = await refreshResponse.json();
          const newToken = data.accessToken;
          
          // Update token and retry
          response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`
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
      expect(response.body.data.accessToken).toBeDefined();
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
    it('should return tokens on valid credentials', async () => {
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
      expect(response.body.data.accessToken).toBeDefined();
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
