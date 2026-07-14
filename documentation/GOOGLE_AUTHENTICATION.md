# Google Authentication Flow

This flow uses the frontend Google Identity Services SDK to get a Google ID token, then sends that token to the EasyStack backend. The backend verifies the token with Google, creates or resolves the EasyStack user, provisions the default workspace when needed, and sets the same HttpOnly auth cookies used by password login.

## Google Cloud Setup

Create a **Web application** OAuth client in Google Cloud Console. This backend uses Google Sign-In ID tokens from the browser, so the OAuth client must be configured for the frontend origin that renders the Google button.

1. Go to Google Cloud Console.
2. Select or create the EasyStack project.
3. Open **APIs & Services -> OAuth consent screen**.
4. Configure the app name, support email, authorized domain, privacy policy, and terms links.
5. Open **APIs & Services -> Credentials**.
6. Click **Create credentials -> OAuth client ID**.
7. Choose **Application type: Web application**.
8. Name it something environment-specific, for example `EasyStack Web - Local` or `EasyStack Web - Production`.

### Authorized JavaScript Origins

Add the frontend application origins only. An origin includes the scheme, host, and port, but no path.

For local development:

```text
http://localhost:3000
http://localhost:5173
```

Use whichever local frontend port you actually run. If you sometimes open the frontend as `127.0.0.1`, add that separately:

```text
http://127.0.0.1:3000
```

For staging and production:

```text
https://stage.easystack.io
https://app.easystack.io
```

Do not add backend API URLs here unless the backend itself renders the Google button. For this project, Google Identity Services runs in the frontend, then the frontend posts the returned ID token to the backend.

### Authorized Redirect URIs

For the current EasyStack implementation, leave **Authorized redirect URIs** empty.

Reason: the frontend receives the Google ID token through the Google Identity Services JavaScript callback and sends it to:

```text
POST /api/auth/providers/google
```

No browser redirect back to the backend is used in this flow.

Only add redirect URIs if the frontend is changed to use Google’s redirect UX (`ux_mode: "redirect"` or equivalent). In that case, use a frontend route that receives the Google credential, for example:

```text
http://localhost:3000/auth/google/callback
https://app.easystack.io/auth/google/callback
```

Do not use `/api/auth/providers/google` as a redirect URI for the current implementation. That endpoint expects a JSON `POST` body with a `credential`; it is not a Google redirect callback.

### Authorized Domains

In the OAuth consent screen, add only top-level domains you control, for example:

```text
easystack.io
```

Do not include scheme, path, or port in authorized domains.

### Client ID

After creating the OAuth client, copy the client ID. It looks like:

```text
1234567890-abc123def456.apps.googleusercontent.com
```

Use the same client ID in:

- the frontend Google Identity Services initialization
- the backend `GOOGLE_AUTH_CLIENT_ID` environment variable

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
  "credential": "<google-id-token>",
  "redirectUrl": "/projects/my-project"
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
    },
    "redirectUrl": "/projects/my-project"
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
  body: JSON.stringify({
    credential,
    redirectUrl: "/projects/my-project",
  }),
});
```

After login, call `GET /api/auth/me` to hydrate the app session, then navigate to the validated `redirectUrl` returned by the backend.

## Setup Checklist

- OAuth client type is **Web application**.
- Frontend URL is listed in **Authorized JavaScript origins**.
- **Authorized redirect URIs** is empty for the current JavaScript callback flow.
- `GOOGLE_AUTH_CLIENT_ID` matches the frontend Google client ID.
- Backend `CORS_ORIGIN` allows the frontend origin.
- Frontend requests use `credentials: "include"` so auth cookies are stored.

## References

- Google Identity Services setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Google Identity Services overview: https://developers.google.com/identity/gsi/web/guides/overview
