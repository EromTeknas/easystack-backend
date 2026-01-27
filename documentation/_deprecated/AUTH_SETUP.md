# Authentication System Setup Guide

## Prerequisites

- MySQL database running and configured
- Node.js 16+
- npm or yarn

## Environment Configuration

Add these variables to your `.env` file:

```env
# JWT Secrets (CHANGE THESE IN PRODUCTION)
JWT_SECRET=your-super-secret-key-min-32-chars-please-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars-please-change-this

# Email Configuration (Brevo)
BREVO_API_KEY=your-brevo-api-key-here
BREVO_SENDER_EMAIL=noreply@easystack.io
BREVO_SENDER_NAME=EasyStack

# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=easystack

# App
NODE_ENV=development
APP_PORT=3000

# Auth (Optional - uses defaults)
BCRYPT_ROUNDS=12
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
```

## Database Setup

### 1. Create Database

```bash
mysql -u root -p < database-setup.sql
```

### 2. Run Migrations

```bash
npm run migrate:up
```

This will create all necessary tables:
- `users` (with email_verified field)
- `email_otps` (OTP verification)
- `refresh_tokens` (session management with revocation)
- `workspaces` (multi-tenancy)
- `workspace_members` (RBAC)

## API Endpoints

### Public Endpoints (No Auth Required)

#### 1. Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

Response: 201 Created
{
  "success": true,
  "data": {
    "userId": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "nextStep": "verify-email"
  }
}
```

#### 2. Verify Email with OTP
```bash
POST /api/auth/verify-email
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "otpCode": "123456"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}

Cookie Set:
refreshToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

#### 3. Resend OTP
```bash
POST /api/auth/resend-otp
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "message": "OTP sent to your email",
    "email": "user@example.com"
  }
}
```

#### 4. Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}

Cookie Set:
refreshToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

#### 5. Refresh Token
```bash
POST /api/auth/refresh
Cookie: refreshToken=...

Response: 200 OK
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}

New Cookie Set:
refreshToken=<new-token>; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

#### 6. Logout
```bash
POST /api/auth/logout
Cookie: refreshToken=...

Response: 200 OK
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### Protected Endpoints (Require Access Token)

#### 7. Get Current User
```bash
GET /api/auth/me
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true,
      "status": "active",
      "createdAt": "..."
    },
    "workspaces": [
      {
        "id": "...",
        "name": "My Workspace",
        "role": "OWNER",
        "createdAt": "..."
      }
    ]
  }
}
```

## Using Authentication in Controllers

### 1. Protect Routes with Authentication

```typescript
import { authenticateToken } from '../../middlewares/authentication.middleware';

router.get('/protected-route', authenticateToken, yourController);
```

The middleware will:
- Extract and verify the JWT access token
- Attach user info to `req.user`
- Return 401 Unauthorized if invalid

### 2. Protect Routes with Authorization (RBAC)

```typescript
import { authorize } from '../../middlewares/authorization.middleware';

// Only workspace owners
router.delete(
  '/workspace/:workspaceId',
  authenticateToken,
  authorize(['OWNER']),
  deleteWorkspaceController
);

// Owners and admins
router.put(
  '/workspace/:workspaceId/settings',
  authenticateToken,
  authorize(['OWNER', 'ADMIN']),
  updateSettingsController
);
```

### 3. In Your Controller

```typescript
export const yourController = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;           // Set by authentication middleware
  const userRole = req.userRole;        // Set by authorization middleware
  const workspaceId = req.workspaceId;  // Set by authorization middleware
  
  // Your logic here
});
```

## Testing

### Using cURL

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Save userId from response

# 2. Verify Email (check inbox for OTP)
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "SAVED_USER_ID",
    "otpCode": "123456"
  }'

# Save accessToken from response

# 3. Get Current User
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer SAVED_ACCESS_TOKEN"
```

### Using Postman

Import the provided Postman collection:
- `EasyStack-Backend-API.postman_collection.json`
- Select environment: `Dev` / `Stage` / `Prod`

The collection automatically saves tokens from responses.

## Security Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Change `JWT_REFRESH_SECRET` to a different strong random string
- [ ] Configure Brevo API key
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS/TLS
- [ ] Set cookies to `secure: true`
- [ ] Configure CORS whitelist
- [ ] Enable database encryption
- [ ] Set up monitoring for failed logins
- [ ] Configure backup strategy
- [ ] Test password reset flow
- [ ] Review rate limiting settings

## Troubleshooting

### Emails Not Sending

Check your Brevo configuration:

```bash
# 1. Verify API key is set
echo $BREVO_API_KEY

# 2. Test Brevo API manually
curl -X POST https://api.brevo.com/v3/smtp/email \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": {"name": "Test", "email": "test@example.com"},
    "to": [{"email": "recipient@example.com"}],
    "subject": "Test",
    "htmlContent": "<p>Test</p>"
  }'
```

### Migrations Not Running

```bash
# Check migration status
npm run migrate:status

# Run migrations manually
npm run migrate:up

# Rollback (if needed)
npm run migrate:down
```

### Token Issues

```bash
# Decode JWT token (to inspect)
# Use: https://jwt.io

# Check token in database
mysql -u root -p easystack
SELECT * FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
```

## Next Steps

1. ✅ Set up all environment variables
2. ✅ Run migrations
3. ✅ Test all endpoints
4. ✅ Implement error handling in frontend
5. ✅ Set up email template customization
6. ✅ Configure workspace features
7. ✅ Implement workspace management APIs
8. ✅ Add two-factor authentication (optional)
9. ✅ Set up audit logging
10. ✅ Deploy to staging environment

## Support

For issues or questions:
1. Check the logs in `storage/logs/`
2. Review `documentation/AUTHENTICATION_ADVANCED.md`
3. Check database tables for data consistency
4. Review error responses for specific error codes

