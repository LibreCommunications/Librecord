# Production Readiness Audit — Remaining Items

---

## Backend

### Database
- **No pagination** on `GetFriendsAsync`, `ListBans`, and search results (search has `limit` but no cursor/offset).

### API Design
- **Oversized responses** — `ListBans` returns full user objects; thread list includes full creator profiles on every item.
- **Inconsistent error format** — some endpoints return `{ error }`, others return `{ success, error }`.

---

## Frontend

### Performance
- **No virtualization on MessageList** — all messages render in the DOM. Severe jank with 100+ messages.
- **Unbounded message array** — `useChatChannel` messages state grows without limit.

---

## Infrastructure

### Docker
- **No volume backup strategy** — `postgres_data` and `minio_data` have no automated backups (ops task, not code).

### Observability
- **No structured logging** — no JSON formatting, no correlation IDs, no centralized sink.
- **No metrics** — no Prometheus, OpenTelemetry, or any request/error rate tracking.

---

## Low Priority / Enhancements

- **No server-side image resizing** — large attachments downloaded at full resolution. CSS constrains display size but bandwidth is wasted. Fix requires imgproxy sidecar or upload-time thumbnail generation.
- **No pagination** on `GetFriendsAsync`, `ListBans` — only matters at scale (1000+ friends/bans per user).
- **Inconsistent error format** — cosmetic, doesn't affect functionality.
