# WEAKNESSES

Comprehensive audit of the Librecord codebase. Organized by severity and category.

---

## CRITICAL

### ~~[SEC-1] No rate limiting anywhere~~ FIXED
- Added global rate limiter (60 req/min per IP), `"auth"` policy (10/min), `"upload"` policy (10/min)

### [SEC-2] Missing authorization checks on pins and threads
- **File:** `Librecord.Api/Controllers/Messaging/PinController.cs` — lines 29-55, 60-70
- **File:** `Librecord.Api/Controllers/Messaging/ThreadController.cs` — lines 32-65, 144-193
- Any authenticated user can pin/unpin messages and create/post in threads in any channel
- **Fix:** Add permission checks (e.g. `ManageChannels` for pins, channel membership for threads)

### [SEC-3] AllowedHosts wildcard in production
- **File:** `Librecord.Api/appsettings.json` line 9: `"AllowedHosts": "*"`
- Accepts requests with any Host header — DNS rebinding risk
- **Fix:** Set environment-specific allowed hosts

### [SEC-4] No environment variable validation on startup
- **File:** `Librecord.Api/Program.cs`
- If `JWT_SIGNING_KEY` or `MESSAGE_ENCRYPTION_KEY` are missing in production, app starts with dev defaults
- **Fix:** Validate required config values at startup, fail fast if missing

---

## HIGH — Architecture

### [ARCH-1] Direct DbContext in controllers (bypasses service layer)
8 controllers inject `LibrecordContext` directly, violating clean architecture:
- `GuildMemberController.cs` — lines 73-80, 97-119, 132-157
- `ChannelPermissionController.cs` — lines 82-116
- `BlockController.cs` — lines 34-55
- `SearchController.cs` — lines 42-70 (also does encryption in controller)
- `PinController.cs` — lines 32-51
- `ThreadController.cs` — lines 38-55, 72-138 (encrypts in controller at line 156)
- `UserProfileController.cs` — lines 41-48, 83-101
- `GuildSettingsController.cs` — lines 56-65, 88-95, 121-126
- **Fix:** Create dedicated services for each (BlockService, PinService, ThreadService, etc.)

### [ARCH-2] Multiple SaveChangesAsync without transactions
- `AttachmentController.cs` — lines 69, 99, 206: sequential saves without transaction scope
- `GuildMemberController.cs` — lines 80, 119, 138: same pattern
- If second save fails, first is already committed → orphaned/inconsistent data
- **Fix:** Wrap multi-step operations in `IDbContextTransaction`

### [ARCH-3] Race condition: DM channel creation not atomic
- `DirectMessageChannelService.cs` — lines 62-67
- Fetch existing DM then create new one is not atomic
- Two users creating same DM simultaneously → duplicate channels
- **Fix:** Use unique constraint + upsert pattern or database-level locking

---

## HIGH — Testing & CI/CD

### [TEST-1] Zero controller tests
- 24/24 controllers in `Librecord.Api/Controllers/` have no test coverage
- Hub tests missing for `DmHub.cs` (7KB) and `GuildHub.cs` (8.8KB)

### [TEST-2] Limited service test coverage
- Only `DirectMessageServiceTests`, `GuildChannelMessageServiceTests`, `AuthServiceTests` exist
- No tests for: PermissionService, ChannelService, PresenceService, VoiceService, FriendshipService (partial), UserService

### [TEST-3] No tests in CI/CD pipeline
- **File:** `.github/workflows/deploy.yml`
- No `dotnet test` step before deployment
- No `npm run lint` for frontend
- Broken tests ship to production undetected

### [TEST-4] No rollback mechanism in deployment
- **File:** `.github/scripts/deploy.sh` lines 56-71
- Health check failure stops new backend but does not restore previous version
- State file in `/tmp` (line 24) — cleared on reboot, loses deployment state

### [TEST-5] No CI caching
- `npm ci` runs without cache on every build
- No dotnet restore caching
- Slows down every deployment

---

## HIGH — Frontend

### ~~[FE-1] No error boundaries~~ FIXED
- Added `ErrorBoundary` component wrapping the entire app in `main.tsx`

### ~~[FE-2] Silent failure on all critical user actions~~ PARTIALLY FIXED
- Added error toasts for message send and file upload failures in both DM and guild pages
- `ChannelSidebar.tsx` permission load still fails silently

### [FE-3] Memory leaks: unreleased Object URLs
- `AttachmentUpload.tsx` line 50: `URL.createObjectURL(file)` never revoked
- `ProfileSettings.tsx` line 34: same — avatar preview URL leaks
- Each file selection without cleanup wastes browser memory
- **Fix:** `URL.revokeObjectURL()` in cleanup/on file change

### [FE-4] No virtual scrolling for message lists
- `MessageList.tsx` renders ALL messages in DOM (no windowing)
- 500+ messages will cause visible jank/slowdown
- **Fix:** Use `react-window` or `@tanstack/react-virtual`

### [FE-5] Zero accessibility (WCAG non-compliance)
- 0 `aria-label`, `aria-describedby`, or `role` attributes in entire codebase
- Icon-only buttons in `GlobalSidebar.tsx`, `MessageItem.tsx`, `GuildPage.tsx` have no labels
- Modals (`ConfirmModal.tsx`) don't trap focus or manage focus on open
- No keyboard navigation for context menus or emoji picker
- **Fix:** Add ARIA labels to all interactive elements, implement focus trap in modals

### [FE-6] Optimistic UI without proper error recovery
- `GuildPage.tsx` lines 287-310: on attachment upload failure, optimistic message removed but `pendingFiles` not restored — user's files are lost
- Reactions (`GuildPage.tsx` line 365-375): optimistic add with no rollback on server rejection
- Delete (`GuildPage.tsx` lines 317-325): immediate removal, no recovery if server fails

---

## MEDIUM — Backend

### [BE-1] N+1 query risk in hubs
- `GuildHub.cs` lines 50-64, 85-93, 251-260: triple nested loops (connect, presence, disconnect) iterating guilds + channels
- `DmHub.cs` lines 52-63, 81-86, 212-218: similar loop patterns
- **Fix:** Batch group operations or flatten query results

### ~~[BE-2] GetChannelOverridesAsync missing WHERE clause~~ FIXED
- Added `.Where(o => o.ChannelId == channelId)` to the query

### ~~[BE-3] Silent exception swallowing~~ FIXED
- `SearchController`: now logs `LogWarning` with message ID on decrypt failure
- `DirectMessageChannelService`: now logs `LogWarning` with attachment URL on delete failure

### [BE-4] No CancellationToken propagation
- No controller or service method accepts or forwards `CancellationToken`
- Long-running requests cannot be cancelled when client disconnects
- Affects all 24 controllers and all service methods

### [BE-5] No logging in Application or Infrastructure layers — PARTIALLY FIXED
- Added `ILogger` to `DirectMessageChannelService` and `SearchController`
- Remaining services and repositories still have no logging
- No audit trail for sensitive operations (message edits/deletes, blocks, permission changes)

### [BE-6] Inconsistent error response formats
- `GuildMemberController.cs` lines 77, 101, 135: returns anonymous objects
- `GuildController.cs` lines 36-41, 52-57: returns anonymous objects
- Other controllers use proper DTOs
- **Fix:** Use consistent DTO responses everywhere

### [BE-7] Missing null checks
- `ThreadController.cs` line 179: `FindAsync(UserId)` with no null check, then `user!.Id` at line 188
- `DirectMessageChannelController.cs` line 36: `m.User.DisplayName` assumes User always present
- `GuildHub.cs` lines 52, 87: `guild.Channels` assumed non-null in foreach

### [BE-8] No FluentValidation — validation is manual and duplicated — PARTIALLY FIXED
- ~~Message length and file size limits hardcoded in multiple places~~ → centralized in `Limits.cs`
- No request DTO validation attributes
- FluentValidation not yet added

### [BE-9] No database retry policy or connection pool tuning
- `Program.cs` lines 149-152: `UseNpgsql()` with no retry config
- No `EnableRetryOnFailure()`, no max pool size, no connection lifetime settings

---

## MEDIUM — Frontend (continued)

### [FE-7] Duplicated message logic across pages
- `DmConversationPage.tsx` and `GuildPage.tsx` share nearly identical:
  - `applyNewMessage()` function
  - Realtime event listener setup
  - Message send/edit/delete handlers
- **Fix:** Extract shared `useChannelMessages` hook

### [FE-8] Heavy prop drilling
- `GuildPage.tsx` passes 15+ props to `MessageList`
- **Fix:** Create `MessageListContext` or compose with hooks

### [FE-9] Missing React.memo on MessageItem
- `MessageItem.tsx` is a plain function export (not memoized)
- Every parent re-render re-renders ALL messages in the list
- **Fix:** Wrap with `React.memo` and stabilize callback props

### [FE-10] XSS risk in markdown renderer
- `MessageItem.tsx` line 107: `dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}`
- `markdown.ts`: URL regex `/(https?:\/\/[^\s<]+)/g` doesn't validate against `javascript:` protocol
- HTML is escaped, but link URL validation is missing
- **Fix:** Validate URLs before wrapping in `<a>` tags

### [FE-11] Missing client-side form validation
- `LoginPage.tsx` lines 53-73: no `required`, no pattern validation on inputs
- `RegisterPage.tsx` lines 55-99: email missing `type="email"`, no length limits
- `CreateChannelModal.tsx` lines 88-99: no `minLength`/`maxLength`/`required`
- **Fix:** Add HTML5 validation attributes at minimum

---

## LOW

### [LOW-1] Docker images unpinned
- `docker-compose.yml` line 63: MinIO uses `:latest` tag
- `docker-compose.yml` line 77: LiveKit uses `:latest` tag
- **Fix:** Pin to specific versions

### [LOW-2] Dockerfile not hardened
- No `USER` directive — runs as root
- Test project copied into build context but never used (line 9)
- **Fix:** Add non-root user, exclude test project from COPY

### [LOW-3] No Content Security Policy headers
- No CSP middleware or headers configured
- Combined with `dangerouslySetInnerHTML` usage, this increases XSS impact
- **Fix:** Add CSP headers via middleware or Nginx

### [LOW-4] setTimeout without cleanup in modals
- `InviteModal.tsx` line 26: `setTimeout(() => setCopied(false), 2000)` — no cleanup on unmount
- **Fix:** Store timeout ID, clear in useEffect cleanup

### [LOW-5] Unrevoked audio unlock listeners
- `realtime/notifications.ts` lines 32-34: `click`, `keydown`, `touchstart` listeners added globally, never removed
- **Fix:** Remove after first unlock

### [LOW-6] Clipboard API not awaited
- `InviteModal.tsx` line 24: `navigator.clipboard.writeText()` promise not awaited or caught
- Fails silently on non-HTTPS contexts
- **Fix:** Await and show error toast on failure

### ~~[LOW-7] Console logging left in production code~~ FIXED
- Removed all 28 `console.log` debug statements; kept `console.warn`/`console.error` for real errors

### ~~[LOW-8] UserId property duplicated across all controllers~~ FIXED
- Created `AuthenticatedController` base class; updated 20 controllers

### [LOW-9] Deploy state file in /tmp
- `.github/scripts/deploy.sh` line 24: `/tmp/${PROJECT}-active-slot`
- Cleared on reboot — deployment state lost
- **Fix:** Store in persistent location (e.g., `/var/lib/librecord/`)

### [LOW-10] Generic client README
- `Librecord.Client/README.md` is the default Vite template README
- No root-level README.md exists
- **Fix:** Write project-specific documentation

---

## Stats

| Category | Critical | High | Medium | Low | Fixed |
|----------|----------|------|--------|-----|-------|
| Security | 3 | — | — | 1 | 1 (SEC-1) |
| Architecture | — | 3 | — | — | — |
| Testing/CI | — | 5 | — | — | — |
| Frontend | — | 4 | 5 | 4 | 2 (FE-1, FE-2 partial) |
| Backend | — | — | 7 | 0 | 4 (BE-2, BE-3, BE-5 partial, BE-8 partial) |
| Infrastructure | — | — | — | 3 | 2 (LOW-7, LOW-8) |
| **Total** | **3** | **12** | **12** | **8** | **9** |
