# TODO

## Replace MinIO presigned-URL redirect with `X-Accel-Redirect`

**Status:** Not started. Current presigned-URL flow works; this is a follow-up simplification.

### Why

The current private-CDN flow is a 4-step, 2-round-trip dance:

```
1. Browser → GET /api/cdn/private/foo.mp4    (cookie)
2. Backend → 302 Location: /storage/...?X-Amz-Signature=…
3. Browser → GET /storage/...?signature…     (follows redirect)
4. Nginx   → proxies to MinIO :9000
```

That redirect chain has caused a running list of bugs:

- Cross-origin cookies aren't sent by `<video>` elements on the second hop → 401 → silent black rectangle in the Electron desktop app
- Browsers re-validate CORS on every redirect hop → required `proxy_hide_header` / `Access-Control-Allow-Origin $http_origin` / `Vary: Origin` tweaks in nginx
- `Range` requests are preserved but with buffering quirks → needed `proxy_buffering off` on `/storage/`
- nginx rate-limiting had to be tuned twice (once for `/api/cdn/private/`, once for generic `/api/`)

### What to change

**Backend** (`Librecord.Api/Controllers/Media/PrivateCdnController.cs`):

```csharp
[HttpGet("{**key}")]
public async Task<IActionResult> Get(string key)
{
    if (string.IsNullOrWhiteSpace(key)) return BadRequest("Missing key");
    if (!await UserCanAccessKeyAsync(key)) return Forbid();

    // Let nginx stream the file directly from MinIO. Zero bytes of
    // payload pass through the dotnet process.
    Response.Headers["X-Accel-Redirect"] = $"/_minio_internal/{key}";
    return new EmptyResult();
}
```

Delete `GetPresignedUrl` usage in this controller. The `MinioAttachmentStorage.GetPresignedUrl` method can stay for future needs (share links, etc.) but isn't used by this path anymore.

**Nginx** — add an `internal` location (only the backend can trigger it):

```nginx
location /_minio_internal/ {
    internal;
    rewrite ^/_minio_internal/(.*)$ /librecord-attachments/$1 break;

    proxy_pass http://minio_prod;               # or minio_test
    proxy_set_header Host minio:9000;
    proxy_hide_header x-amz-request-id;
    proxy_hide_header x-amz-id-2;

    proxy_buffering off;
    proxy_request_buffering off;
    proxy_http_version 1.1;
}
```

Then **delete** the `/storage/` location in both server blocks — no more external MinIO proxy, no more CORS headers on it, no more `Vary: Origin`, nothing. Client-facing URLs never point at `/storage/` anymore.

### Why it solves things

- **One HTTP request**, one response. `<video src="/api/cdn/private/foo.mp4">` gets bytes back directly — no redirect to follow, so all the cross-origin-cookie-on-redirect issues evaporate.
- **Same-origin from the client's perspective**. CORS becomes irrelevant for the media path because nothing crosses origins anymore (it all terminates at `librecord.gros-sans-dessein.com`).
- **Electron desktop app "just works"** — no `crossOrigin="use-credentials"`, no `webSecurity` quirks, no `file://` vs `http://localhost` cookie edge cases.
- **Smaller backend** — `GetPresignedUrl` code path removed from the hot path.
- **Smaller nginx** — `/storage/` block deleted (~30 LOC gone).
- **Client code unchanged** — `MessageItem.tsx`, download helper, etc. all keep working.

### What we'd lose

- Can no longer hand someone a direct-to-MinIO URL to share a file outside the app. We don't currently do this, but if we ever want to (public share links with expiry), we'd add a separate endpoint specifically for it.

### Estimated scope

- **Backend**: one controller method changed (~5 lines), one unused import removed.
- **Nginx**: add `/_minio_internal/` location (~10 lines), delete `/storage/` (~30 lines). Net `-20` lines.
- **Client**: nothing.
- **Testing**: exercise every attachment type (image/video/audio/generic file) in web + desktop, confirm Range requests still serve partial content for video seek.

### Related cleanup while we're in there

- Use `upstream minio_prod { server 127.0.0.1:9000; }` / `upstream minio_test { server 127.0.0.1:9010; }` blocks so the IP+port isn't duplicated across four locations.
- Drop the `(avatars|guild-icons|banners|thumbnails|emojis)` allow-list in `/api/cdn/public/` — the backend already controls what gets uploaded to public paths. Defense-in-depth argument is weak.
