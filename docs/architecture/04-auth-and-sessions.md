# Authentication & Session Architecture (Phase 4)

## Overview

GitLeague uses an industry-standard, secure server-side session architecture coupled with GitHub OAuth 2.0. Sensitive credentials and provider access tokens are **never** exposed to client applications, logs, or stored in plaintext.

```text
Browser / Client                      API Server                              GitHub OAuth / DB
       │                                   │                                          │
       │─── 1. Click "Sign in" ───────────>│                                          │
       │                                   │─── 2. Generate cryptographically         │
       │                                   │       random CSRF state & store in DB───>│ (OAuthState with TTL)
       │<── 3. Redirect to GitHub ─────────│                                          │
       │                                                                              │
       │─── 4. User Authorizes GitLeague Application ────────────────────────────────>│
       │                                                                              │
       │<── 5. GitHub Redirects with ?code=...&state=... ─────────────────────────────│
       │                                   │                                          │
       │─── 6. Send Callback ─────────────>│                                          │
       │                                   │─── 7. Atomically consume & validate state│ (Prevents replay/CSRF)
       │                                   │─── 8. Exchange code for OAuth token ────>│
       │                                   │<── 9. Receive GitHub access token ───────│
       │                                   │─── 10. Fetch user identity ─────────────>│
       │                                   │─── 11. Encrypt token at rest (AES-256-GCM)
       │                                   │─── 12. Upsert GitLeague User ───────────>│ (UserModel)
       │                                   │─── 13. Create Server Session ───────────>│ (SessionModel with hash)
       │<── 14. Set HttpOnly Cookie ───────│                                          │
       │        & Redirect to WEB_ORIGIN   │                                          │
       │                                   │                                          │
       │─── 15. GET /api/v1/auth/me ──────>│                                          │
       │        (Cookie attached)          │─── 16. Hash cookie token, lookup session,
       │                                   │        and resolve safe user representation
       │<── 17. Return ISafeUser ──────────│                                          │
```

---

## 🔒 Security Principles & Controls

### 1. Token Protection at Rest
- GitHub OAuth access tokens are encrypted using **AES-256-GCM** with random 96-bit Initialization Vectors (IVs) and 128-bit authentication tags.
- Format: `v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
- Even with direct read access to MongoDB, encrypted tokens cannot be decrypted without the server's `TOKEN_ENCRYPTION_SECRET`.
- Plaintext access tokens are stripped before returning responses and redacted from Pino logs.

### 2. Server-Side Hashed Sessions
- The browser receives an opaque 64-character hex session token stored in a secure cookie.
- The database stores **only a SHA-256 hash** of the session token.
- A database leak does not disclose active raw cookies.
- Sessions include automatic MongoDB TTL indexing for expiration cleanup.

### 3. Login CSRF / OAuth State Protection
- Cryptographically secure 48-char hex states are generated for each login initiation.
- States are stored in MongoDB with a 10-minute TTL.
- In the callback, `OAuthStateRepository.consumeState(state)` performs an atomic `findOneAndDelete` with expiration check.
- Replaying or reusing a state parameter is rejected with `400 Bad Request`.

### 4. Multi-User Isolation
- Auth context is strictly request-scoped (`req.user`, `req.session`).
- No shared module-level singletons or global state exist.
- Sessions are validated independently per HTTP request.

---

## ⚙️ Configuration Variables

| Variable | Description | Default (Dev) |
|---|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | `dev_github_client_id` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | `dev_github_client_secret` |
| `GITHUB_CALLBACK_URL` | Registered OAuth callback URL | `http://localhost:4000/api/v1/auth/github/callback` |
| `WEB_ORIGIN` | Frontend origin for redirect post-auth | `http://localhost:5173` |
| `TOKEN_ENCRYPTION_SECRET` | 32+ byte key for AES-256-GCM token encryption | `0123456789abcdef...` |
| `COOKIE_NAME` | Name of the session cookie | `gitleague_session` |
| `COOKIE_SECURE` | Set `Secure` flag on cookie | `false` (dev) / `true` (prod) |
| `COOKIE_SAME_SITE` | Cookie SameSite policy (`lax`, `strict`, `none`) | `lax` |
| `SESSION_TTL_DAYS` | Session lifetime in days | `30` |

---

## 📡 Endpoints

### `GET /api/v1/auth/github`
Initiates the GitHub OAuth flow, generates state parameter, and redirects browser to GitHub.

### `GET /api/v1/auth/github/callback`
Validates state parameter, exchanges code for access token, upserts User, creates session, sets HttpOnly cookie, and redirects to frontend application.

### `GET /api/v1/auth/me`
Requires active session (`requireAuth`). Returns public safe user representation and session expiry.

### `POST /api/v1/auth/logout`
Deletes active session from database, clears authentication cookie, and returns `200 OK` (idempotent).
