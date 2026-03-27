# Production Readiness Audit — Remaining Items

---

## Backend

### Security
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
- **No server-side image resizing** — large attachments loaded at full resolution.

---

## Infrastructure

### Docker
- **No volume backup strategy** — `postgres_data` and `minio_data` have no automated backups (ops task, not code).

### Observability
- **No structured logging** — no JSON formatting, no correlation IDs, no centralized sink.
- **No metrics** — no Prometheus, OpenTelemetry, or any request/error rate tracking.
