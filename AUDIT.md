# Production Readiness Audit

---

## Backend

### Security

- ~~Missing input validation on request DTOs~~ — fixed. Added `[MaxLength]`, `[MinLength]`, `[Required]`, `[EmailAddress]` to all request DTOs and inline request classes. Search query capped at 256 chars.
- **File upload MIME type not validated server-side** — `AttachmentController` and `UserProfileController` trust client-provided `ContentType` header. Validate actual file magic bytes instead.
- **VoiceController.GetParticipants** doesn't check channel membership — any authenticated user can enumerate voice participants.
- **ThreadController** returns thread creator info without verifying caller has channel access.
- ~~CORS too permissive~~ — fixed. Restricted to `GET/POST/PUT/DELETE` and `Content-Type` header only.
- ~~`AllowedHosts = "*"`~~ — fixed. Production deploy now sets `AllowedHosts` to the actual domain via env var. Dev keeps `*` for localhost.
- **No rate limiting on sensitive endpoints** — friend requests, search, invite creation, and message sending have no `[EnableRateLimiting]`.
- **Auth failures not logged** — `OnAuthenticationFailed` in `Program.cs` returns `Task.CompletedTask` silently. Log failed auth attempts.

### Error Handling

- ~~CDN controllers swallow all exceptions~~ — fixed. CDN controllers now use presigned URL redirects; exception handling simplified.
- ~~SignalR hub `OnConnectedAsync` has no try-catch~~ — fixed. Wrapped in try-catch with structured error logging, re-throws to let SignalR handle the disconnect.
- **`GlobalExceptionHandler`** returns generic message without logging stack traces in production.

### Database

- ~~Missing indexes~~ — fixed. FK indexes were already auto-created by EF; added `Messages.CreatedAt` index for pagination.
- **No pagination** on `GetFriendsAsync`, `ListBans`, and search results (search has `limit` but no cursor/offset).
- ~~Race condition in `JoinByCodeAsync`~~ — fixed. Wrapped in transaction via `IUnitOfWork`.
- ~~Transaction gaps~~ — fixed. Added `IUnitOfWork` with transactions to `BanMemberAsync`, `BlockUserAsync`, `LeaveChannelAsync`, `DeleteDmAsync`, `JoinVoiceChannelAsync`. Storage deletes moved to after DB commit.
- **`StartDmAsync`** doesn't validate both users exist before creating a channel.

### API Design

- **Oversized responses** — `ListBans` returns full user objects; thread list includes full creator profiles on every item.
- **Inconsistent error format** — some endpoints return `{ error }`, others return `{ success, error }`.

---

## Frontend

### Security

- **XSS risk via `dangerouslySetInnerHTML`** — `MessageItem.tsx` renders markdown-processed HTML directly. If the markdown renderer has edge cases, this is exploitable. Sanitize with DOMPurify.
- **Sensitive data in sessionStorage** — voice session state (channel IDs, guild IDs) stored in `librecord:voiceSession` without encryption.

### Performance

- **No virtualization on MessageList** — all messages render in the DOM. Severe jank with 100+ messages. Use `@tanstack/react-virtual`.
- **Unbounded message array** — `useChatChannel` messages state grows without limit as the user scrolls history. No pruning or windowing.
- **MessageItem memo broken** — wrapped in `memo()` but parent passes inline arrow function handlers, defeating memoization. Use `useCallback` in MessageList.
- **No server-side image resizing** — large attachments loaded at full resolution on all devices.

### State Management

- **Race condition in load-more** — `useChatChannel` stale check happens after `await`; no `AbortController` to cancel in-flight requests on channel change.
- **Object URL leak** — `AttachmentUpload.tsx` creates blob URLs via `URL.createObjectURL` but cleanup may not fire if component unmounts during a state update.

### Error Handling

- **Silent message deletion failure** — `useChatChannel` has `try { await config.deleteMessage(...) } catch { /* best-effort */ }`. User thinks it succeeded.
- **No error boundary on routes** — `ErrorBoundary` component exists but isn't wrapping route components. A single component crash takes down the whole app.

### Accessibility

- **Modals lack focus trapping** — `JoinGuildModal`, `ConfirmModal`, `CreateGroupModal` have no `role="dialog"`, no `aria-modal`, no focus trap, no focus restore on close.
- **Missing ARIA labels** — icon-only buttons in `MessageItem.tsx` (edit, delete, pin) have `title` but no `aria-label`.
- **No `:focus-visible` styling** — keyboard users can't see where focus is.
- **Form label association** — some inputs lack `id`/`htmlFor` pairing.

---

## Infrastructure

### Docker

- ~~Containers run as root~~ — fixed, `Dockerfile` now uses non-root `appuser`.
- **No resource limits** — `docker-compose.yml` services have no `mem_limit` or `cpus`. One runaway service can starve the host.
- **No health checks on MinIO or LiveKit** — only PostgreSQL has a healthcheck. Docker won't restart failed services.
- **No volume backup strategy** — `postgres_data` and `minio_data` have no automated backups.
- **LiveKit uses `network_mode: host`** — bypasses Docker network isolation.

### Nginx

All addressed in `nginx.conf` + `nginx-hardening.conf`.

### CI/CD

- **No smoke tests after deploy** — only `/health` is checked. DB connectivity, storage, and API functionality are not verified.
- **No rollback on post-deploy failure** — if the app passes health check but breaks under load, no automated recovery.
- **No build caching** — `npm ci` and `docker pull` run fresh every deploy.
- **Deploy state file has no locking** — concurrent deploys can corrupt `active-slot`.
- **Migrations run at app startup with no pre-check** — migration failure after nginx cutover causes downtime.

### Observability

- **No structured logging** — default `ILogger` with no JSON formatting, no correlation IDs, no centralized sink.
- ~~Basic `/health` endpoint~~ — fixed. Now checks DB (`SELECT 1`) and MinIO (`ExistsAsync`) connectivity. Returns 503 if either is unhealthy.
- **No metrics** — no Prometheus, OpenTelemetry, or any request/error rate tracking.
