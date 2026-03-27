# Production Readiness Audit — Remaining Items

---

## Backend

### Security
- **File upload MIME type not validated server-side** — `AttachmentController` and `UserProfileController` trust client-provided `ContentType` header. Validate actual file magic bytes instead.
- **ThreadController** returns thread creator info without verifying caller has channel access.
- **No rate limiting on sensitive endpoints** — friend requests, search, invite creation, and message sending have no `[EnableRateLimiting]`.

### Database
- **No pagination** on `GetFriendsAsync`, `ListBans`, and search results (search has `limit` but no cursor/offset).

### API Design
- **Oversized responses** — `ListBans` returns full user objects; thread list includes full creator profiles on every item.
- **Inconsistent error format** — some endpoints return `{ error }`, others return `{ success, error }`.

---

## Frontend

### Security
- **XSS risk via `dangerouslySetInnerHTML`** — `MessageItem.tsx` renders markdown-processed HTML directly. Sanitize with DOMPurify.
- **Sensitive data in sessionStorage** — voice session state (channel IDs, guild IDs) stored unencrypted.

### Performance
- **No virtualization on MessageList** — all messages render in the DOM. Severe jank with 100+ messages.
- **Unbounded message array** — `useChatChannel` messages state grows without limit.
- **MessageItem memo broken** — parent passes inline arrow function handlers, defeating memoization.
- **No server-side image resizing** — large attachments loaded at full resolution.

### State Management
- **Race condition in load-more** — no `AbortController` to cancel in-flight requests on channel change.
- **Object URL leak** — `AttachmentUpload.tsx` cleanup may not fire on unmount during state update.

---

## Infrastructure

### Docker
- **No resource limits** — services have no `mem_limit` or `cpus`.
- **No volume backup strategy** — `postgres_data` and `minio_data` have no automated backups.
- **LiveKit uses `network_mode: host`** — bypasses Docker network isolation.

### CI/CD
- **No build caching** — `npm ci` and `docker pull` run fresh every deploy.
- **Deploy state file has no locking** — concurrent deploys can corrupt `active-slot`.
- **Migrations run at app startup with no pre-check** — migration failure after nginx cutover causes downtime.

### Observability
- **No structured logging** — no JSON formatting, no correlation IDs, no centralized sink.
- **No metrics** — no Prometheus, OpenTelemetry, or any request/error rate tracking.
