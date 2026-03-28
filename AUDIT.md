# Production Readiness Audit — Remaining Items

## Infrastructure

### Observability
- **No structured logging** — no JSON formatting, no correlation IDs, no centralized sink.
- **No metrics** — no Prometheus, OpenTelemetry, or any request/error rate tracking.

---

## Low Priority / Enhancements

- **No server-side image resizing** — large attachments downloaded at full resolution. CSS constrains display size but bandwidth is wasted. Fix requires imgproxy sidecar or upload-time thumbnail generation.
- **Inconsistent error format** — some endpoints return `{ error }`, others return `{ success, error }`.
