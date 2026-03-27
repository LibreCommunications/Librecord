# Production Readiness Audit — Remaining Items

## Frontend / Backend

### Performance
- **No virtualization on MessageList** — all messages render in the DOM. Severe jank with 100+ messages.
- **Unbounded message array** — `useChatChannel` messages state grows without limit.

---

## Infrastructure

### Observability
- **No structured logging** — no JSON formatting, no correlation IDs, no centralized sink.
- **No metrics** — no Prometheus, OpenTelemetry, or any request/error rate tracking.

---

## Low Priority / Enhancements

- **No server-side image resizing** — large attachments downloaded at full resolution. CSS constrains display size but bandwidth is wasted. Fix requires imgproxy sidecar or upload-time thumbnail generation.
- **Inconsistent error format** — some endpoints return `{ error }`, others return `{ success, error }`.
