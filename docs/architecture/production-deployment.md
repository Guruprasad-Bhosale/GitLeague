# GitLeague Production Deployment & Operations Guide

## 1. Production Architecture Overview

```
                           +------------------------+
                           |  Vercel Edge Network   |
                           |   (React / SPA Web)    |
                           +-----------+------------+
                                       |
                   HTTPS (OAuth, REST) | https://api.gitleague.dev
                                       v
                     +----------------------------------+
                     |  Render / Railway Web Service    |
                     |         (Node.js API)            |
                     |  - Helmet CSP, HSTS, Rate Limit  |
                     |  - Proxy-Aware Trust Proxy       |
                     |  - Non-blocking Cache Read/Write |
                     +-------+------------------+-------+
                             |                  |
           Direct Enqueue    |                  | Query / Upsert
                             v                  v
    +---------------------------------+  +--------------------------------+
    |  Upstash / Managed Redis Engine |  |  MongoDB Atlas Cluster         |
    |  - BullMQ Queue (github-sync)   |  |  - M10+ Recommended            |
    |  - API Cache (5m / 60s TTL)     |  |  - Connection Pool (min 5, 20) |
    |  - Namespaced: gitleague:prod:* |  |  - Compound Indexes Synced     |
    +----------------+----------------+  +---------------+----------------+
                     |                                   |
         Worker Pop  |                                   | Profile Upsert
                     v                                   |
    +---------------------------------+                  |
    |  Render / Railway Background    |                  |
    |       (Worker Service)          |<-----------------+
    |  - Concurrency: 5-20            |
    |  - GitHub Categorized Errors    |
    |  - Graceful Shutdown (10s)      |
    +----------------+----------------+
                     |
                     | Octokit REST Aggregation
                     v
             GitHub Public API
```

---

## 2. Environment Variables Matrix

| Variable | Target Scope | Classification | Description | Example / Constraint |
|---|---|---|---|---|
| `NODE_ENV` | API, Worker, Web | `[PUBLIC]` | Runtime environment | `production` |
| `PORT` | API | `[SERVER ONLY]` | HTTP server bind port | `4000` |
| `HOST` | API | `[SERVER ONLY]` | HTTP server bind host | `0.0.0.0` |
| `FRONTEND_URL` | API | `[SERVER ONLY]` | Allowed CORS origins (comma-separated, no wildcard) | `https://gitleague.dev,https://app.gitleague.dev` |
| `API_URL` | API | `[SERVER ONLY]` | Public root API endpoint URL | `https://api.gitleague.dev` |
| `TRUST_PROXY` | API | `[SERVER ONLY]` | Reverse proxy hop count or boolean | `1` or `true` (Render/Railway) |
| `MONGODB_URI` | API, Worker | `[SECRET]` | Production MongoDB Atlas connection URI | `mongodb+srv://user:pass@cluster.mongodb.net/gitleague?retryWrites=true&w=majority` |
| `REDIS_HOST` | API, Worker | `[SECRET]` | Managed Redis hostname | `us1-redis.upstash.io` |
| `REDIS_PORT` | API, Worker | `[SERVER ONLY]` | Redis port | `6379` |
| `REDIS_PASSWORD` | API, Worker | `[SECRET]` | Redis authentication password | `your-secure-redis-password` |
| `SESSION_SECRET` | API | `[SECRET]` | Cookie session signing secret | High entropy string (min 32 chars) |
| `ENCRYPTION_SECRET`| API, Worker | `[SECRET]` | AES-256-GCM token encryption key | Exactly 64 hexadecimal characters (32 bytes) |
| `GITHUB_CLIENT_ID` | API | `[SERVER ONLY]` | GitHub OAuth application client ID | `Iv1.xxxxxxxxxxxx` |
| `GITHUB_CLIENT_SECRET`| API | `[SECRET]` | GitHub OAuth application client secret | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `WORKER_CONCURRENCY` | Worker | `[WORKER ONLY]`| BullMQ concurrent jobs per worker replica | `5` (range 1 - 50) |
| `VITE_API_URL` | Web | `[PUBLIC]` | Frontend API target endpoint | `https://api.gitleague.dev/api/v1` |

---

## 3. Pre-Deployment & Provisioning Steps

### A. Database Provisioning (MongoDB Atlas)
1. Create a MongoDB Atlas Project & M10+ Dedicated Cluster.
2. In Network Access, add Render / Railway outbound IP addresses (or `0.0.0.0/0` with strict SCRAM authentication).
3. In Database Access, create a database user with `readWrite` permissions on `gitleague`.
4. Run the idempotent database index & active season initialization script:
```bash
pnpm seed:production
```

### B. Redis Provisioning (Upstash / Redis Cloud)
1. Create a Redis database with TLS enabled and persistence enabled (AOF recommended for BullMQ queues).
2. Verify connectivity from worker and API environments.

### C. GitHub OAuth App Setup
1. Open GitHub Developer Settings -> OAuth Apps -> New OAuth App.
2. Application Name: `GitLeague`
3. Homepage URL: `https://gitleague.dev`
4. Authorization callback URL: `https://api.gitleague.dev/api/v1/auth/github/callback`

---

## 4. Platform Deployment Instructions

### Vercel (Web Frontend)
1. Link GitHub repository to Vercel.
2. Root Directory: `apps/web` (or workspace root with `pnpm --filter @gitleague/web build`).
3. Output Directory: `dist`
4. Environment Variables:
   - `VITE_API_URL`: `https://api.gitleague.dev/api/v1`
5. `vercel.json` provides automatic SPA rewrites (`/(.*) -> /index.html`) and security headers.

### Render / Railway (API Web Service)
1. Service Type: **Web Service / Docker**
2. Dockerfile: `Dockerfile.api`
3. Health Check Path: `/api/v1/health`
4. Set all `[SERVER ONLY]` and `[SECRET]` environment variables from the Matrix.
5. Ensure `TRUST_PROXY=1` is configured so client IPs and secure cookies function properly.

### Render / Railway (Sync Worker Service)
1. Service Type: **Background Worker / Docker**
2. Dockerfile: `Dockerfile.worker`
3. Set all `[WORKER ONLY]` and `[SECRET]` environment variables.
4. Scale worker replicas based on queue volume (`WORKER_CONCURRENCY=5-20`).

---

## 5. Security & Secret Rotation Procedures

### A. Token Encryption Key Rotation (`ENCRYPTION_SECRET`)
The `ENCRYPTION_SECRET` is used for AES-256-GCM encryption of user GitHub OAuth tokens:
1. Generate new 64-hex-character secret: `openssl rand -hex 32`.
2. Deploy dual-key decryption migration utility to decrypt existing tokens with old key and re-encrypt with new key.
3. Update `ENCRYPTION_SECRET` across API and Worker environment variables and trigger zero-downtime rolling restart.

### B. Session Secret Rotation (`SESSION_SECRET`)
1. Generate new high-entropy session secret: `openssl rand -hex 32`.
2. Update `SESSION_SECRET` on API instances.
3. Note: Users with existing active sessions will be required to re-authenticate.

---

## 6. Incident Response & Failure Runbooks

### Runbook 1: GitHub API Rate Limiting (429 / Secondary Limits)
* **Symptom**: Worker logs show `GitHubRateLimitError (429)`.
* **Behavior**: Worker catches error, preserves retry queue, and applies exponential backoff until reset time (`x-ratelimit-reset`).
* **Remediation**:
  1. Reduce worker concurrency: set `WORKER_CONCURRENCY=2`.
  2. If using personal tokens for system queries, ensure individual user tokens are being used per sync job (already implemented).

### Runbook 2: Redis Outage / Unavailability
* **API Behavior**: `CacheService` degrades non-blockingly to direct MongoDB queries. No 500 errors returned to users.
* **Worker Behavior**: BullMQ pauses queue processing and reconnects automatically when Redis recovers.
* **Remediation**:
  1. Check Upstash/Redis connection limits and memory usage.
  2. Flush volatile cache keys if memory ceiling is reached (`gitleague:prod:leaderboard:*`).

### Runbook 3: GitHub Token Revocation Storm
* **Symptom**: Multiple users revoke OAuth access on GitHub.
* **Behavior**: Worker categorizes 401 Unauthorized errors as non-retryable, marks user `syncStatus = 'failed'` with notice `'GitHub authorization expired or revoked. Please sign in again to reconnect.'`, and does not flood retries.
* **Remediation**: Web UI automatically surfaces the `Reconnect GitHub` button.
