# Google Authentication Flow

This flow uses the frontend Google Identity Services SDK to get a Google ID token, then sends that token to the EasyStack backend. The backend verifies the token with Google, creates or resolves the EasyStack user, provisions the default workspace when needed, and sets the same HttpOnly auth cookies used by password login.

## Backend Setup

Add the Google OAuth client ID to the backend environment:

```bash
GOOGLE_AUTH_CLIENT_ID="your-google-oauth-client-id.apps.googleusercontent.com"
```

The backend routes are:

```text
POST /api/auth/providers/google
POST /api/auth/providers/google/link
```

## New User Or Login

Use this endpoint when a visitor clicks "Continue with Google".

```http
POST /api/auth/providers/google
Content-Type: application/json

{
  "credential": "<google-id-token>"
}
```

Successful response sets the `accessToken` and `refreshToken` HttpOnly cookies:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "user@example.com",
      "firstName": "User",
      "lastName": "Example",
      "onboardingCompleted": false,
      "defaultWorkspaceId": 1
    }
  }
}
```

Important behavior:

- If the Google account is already linked, the user is logged in.
- If no EasyStack account exists for that email, a new verified user is created with a default workspace and free plan.
- If a password account already exists for the same email, the user must log in with password first and link Google from account settings.

## Link Google To An Existing Account

Call this endpoint from an authenticated account settings screen. The request must include the existing auth cookies.

```http
POST /api/auth/providers/google/link
Content-Type: application/json
Cookie: accessToken=...

{
  "credential": "<google-id-token>"
}
```

The Google email must match the signed-in EasyStack account email. On success:

```json
{
  "success": true,
  "data": {
    "message": "Google account linked successfully"
  }
}
```

## Frontend Notes

1. Load Google Identity Services with the same client ID as `GOOGLE_AUTH_CLIENT_ID`.
2. Ask Google for an ID token credential.
3. Send the returned `credential` string to `/api/auth/providers/google`.
4. Include credentials on fetch requests so cookies are accepted:

```ts
await fetch("/api/auth/providers/google", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ credential }),
});
```

After login, call `GET /api/auth/me` to hydrate the app session.
