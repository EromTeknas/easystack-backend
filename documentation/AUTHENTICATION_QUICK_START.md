# Authentication Quick Start

Quick guide to using the JWT-based authentication system.

---

## Setup

### 1. Database Schema

Run the SQL migration to create tables:

```bash
# Open MySQL
mysql -u easystack -p easystack

# Paste the content from documentation/auth-schema.sql
```

Or copy from [auth-schema.sql](auth-schema.sql):
```sql
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('USER', 'ADMIN', 'MODERATOR') DEFAULT 'USER',
  ...
);
```

### 2. Environment Variables

Update `.env` with JWT secrets:

```env
# JWT Authentication
JWT_SECRET=your-super-secret-key-min-32-characters-long-must-be-changed!!!
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-characters-long-must-be-changed!!!
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:3000
```

---

## API Examples

### Register New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "USER"
    },
    "accessToken": "eyJhbGci...",
    "expiresIn": 900
  }
}
```

**Cookies Set:**
- `refreshToken` (HttpOnly, Secure, 7 days)

---

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:** Same as register

---

### Refresh Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=<jwt>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGci...",
    "expiresIn": 900
  }
}
```

---

### Get Current User

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "USER",
      "email_verified": false,
      "last_login_at": "2026-01-26T10:30:00Z"
    }
  }
}
```

---

### Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: refreshToken=<jwt>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Protected Routes

### Create a Protected Endpoint

```typescript
// src/routes/users/users.routes.ts
import { Router } from 'express';
import { authenticateToken, authorize } from '../../middlewares/authentication.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// Protected route - requires authentication
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: { userId: req.user.id } });
}));

// Protected route - requires ADMIN role
router.delete('/:id', 
  authenticateToken,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { message: 'User deleted' } });
  })
);

export default router;
```

---

## Frontend Integration

### Setup Auth Hook (React Example)

```typescript
// hooks/useAuth.ts
import { useState, useCallback } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include', // Include refresh cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
      return true;
    } else {
      await logout();
      return false;
    }
  }, [logout]);

  return {
    user,
    accessToken,
    loading,
    login,
    logout,
    refreshSession
  };
};
```

### Setup API Client with Auto-Refresh

```typescript
// utils/api.ts
export const createApiClient = (getAccessToken, refresh) => {
  return {
    async request(url: string, options = {}) {
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
        const refreshed = await refresh();
        if (refreshed) {
          // Retry with new token
          const newToken = getAccessToken();
          response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`
            }
          });
        } else {
          // Redirect to login
          window.location.href = '/login';
        }
      }

      return response;
    }
  };
};
```

---

## Middleware Usage

### Authentication Middleware

Verifies JWT access token from Authorization header:

```typescript
import { authenticateToken } from '../middlewares/authentication.middleware';

router.get('/protected', authenticateToken, handler);
```

Sets `req.user` with:
```typescript
{
  id: string;
  email: string;
  role: string;
}
```

### Authorization Middleware

Checks if user has required role:

```typescript
import { authorize } from '../middlewares/authentication.middleware';

router.delete('/admin', 
  authenticateToken,
  authorize('ADMIN'),
  handler
);

// Multiple roles
router.patch('/moderate',
  authenticateToken,
  authorize('ADMIN', 'MODERATOR'),
  handler
);
```

---

## Password Requirements

Passwords must meet these requirements:
- ✅ Minimum 12 characters
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)
- ✅ At least one special character (!@#$%^&*...)

**Example valid passwords:**
- `SecurePass123!`
- `MyPassword@2024`
- `ComplexOne#$%`

---

## Token Lifecycle

### Access Token (15 minutes)
- Stored in memory (frontend)
- Sent in `Authorization: Bearer` header
- Expires after 15 minutes
- Cannot be refreshed

### Refresh Token (7 days)
- Stored in HttpOnly cookie
- Never accessed by JavaScript
- Can be used to get new access token
- Automatically rotated (optional)
- Revoked on logout

### Refresh Flow
```
1. Access token expires
2. Frontend gets 401 Unauthorized
3. Frontend calls POST /auth/refresh
4. Backend validates refresh token
5. Backend issues new access token
6. Frontend retries original request
```

---

## Security Features

✅ **Passwords**: Hashed with bcrypt (12 rounds)  
✅ **Tokens**: Signed with strong secret keys  
✅ **Refresh Tokens**: Stored as hash in database  
✅ **Cookies**: HttpOnly, Secure, SameSite=Strict  
✅ **Rate Limiting**: 5 auth attempts per 15 minutes  
✅ **Validation**: Input validation on all endpoints  
✅ **Errors**: Generic messages (no info leakage)  

---

## Troubleshooting

### Token Expired
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token expired"
  }
}
```
**Solution**: Frontend should call `/auth/refresh`

### Invalid Credentials
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```
**Solution**: Check email and password are correct

### Rate Limited
```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many authentication attempts"
  }
}
```
**Solution**: Wait 15 minutes before retrying

### No Refresh Token
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Refresh token not found"
  }
}
```
**Solution**: User needs to login again. Ensure cookies are enabled.

---

## Full Documentation

See [AUTHENTICATION.md](AUTHENTICATION.md) for:
- Complete system design
- Database schema
- All API endpoints
- Frontend integration patterns
- Security implementation details
- Multi-device support
- Testing strategies

---

[← Back to README](../README.md)
