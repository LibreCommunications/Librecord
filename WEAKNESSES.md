# WEAKNESSES

Comprehensive audit of the Librecord codebase. Organized by severity and category.

---

## CRITICAL

### ~~[SEC-1] No rate limiting anywhere~~ FIXED
- Added global rate limiter (60 req/min per IP), `"auth"` policy (10/min), `"upload"` policy (10/min)

### [SEC-3] AllowedHosts wildcard in production — REVERTED
- Reverted to `"*"` — Nginx handles host filtering in production; restricting at app level caused issues

### ~~[SEC-4] No environment variable validation on startup~~ FIXED
- App now fails fast if JWT config, connection string, or encryption key are missing/invalid

### ~~[SEC-2] Missing authorization checks on pins and threads~~ FIXED
- PinController: membership check via `IPinService.IsChannelMemberAsync` on all endpoints
- ThreadController: membership check on List, GetMessages, PostMessage (Create already had it)
- **File:** `Librecord.Api/Controllers/Messaging/PinController.cs` — lines 29-55, 60-70
- **File:** `Librecord.Api/Controllers/Messaging/ThreadController.cs` — lines 32-65, 144-193
- Any authenticated user can pin/unpin messages and create/post in threads in any channel
- **Fix:** Add permission checks (e.g. `ManageChannels` for pins, channel membership for threads)

### ~~[SEC-3] AllowedHosts wildcard in production~~ FIXED (see above)

### ~~[SEC-4] No environment variable validation on startup~~ FIXED (see above)

---

## HIGH — Architecture

### ~~[ARCH-1] Direct DbContext in controllers~~ FIXED
- All 10 controllers migrated to use dedicated services/repositories
- Created: IBlockService, IGuildMemberService, IGuildSettingsService, IPinService, IThreadService, IMessageSearchService, IAttachmentService
- Extended: IUserService, IPermissionService, IGuildRepository, IBlockRepository
- Zero `LibrecordContext` usage in any controller

### [ARCH-2] Multiple SaveChangesAsync without transactions
- `AttachmentController.cs` — lines 69, 99, 206: sequential saves without transaction scope
- `GuildMemberController.cs` — lines 80, 119, 138: same pattern
- If second save fails, first is already committed → orphaned/inconsistent data
- **Fix:** Wrap multi-step operations in `IDbContextTransaction`

### ~~[ARCH-3] Race condition: DM channel creation not atomic~~ FIXED
- StartDmAsync now catches save failures and re-fetches existing channel
- If a concurrent request created the same DM, the retry finds and returns it

---

## HIGH — Testing & CI/CD

### [TEST-1] Zero controller tests
- 24/24 controllers in `Librecord.Api/Controllers/` have no test coverage
- Hub tests missing for `DmHub.cs` (7KB) and `GuildHub.cs` (8.8KB)

### [TEST-2] Limited service test coverage
- Only `DirectMessageServiceTests`, `GuildChannelMessageServiceTests`, `AuthServiceTests` exist
- No tests for: PermissionService, ChannelService, PresenceService, VoiceService, FriendshipService (partial), UserService

### ~~[TEST-3] No tests in CI/CD pipeline~~ FIXED
- Added `dotnet test` and `npm run lint` steps before deployment
- ESLint now at zero errors/warnings (81→0 properly fixed)

### [TEST-4] No rollback mechanism in deployment
- **File:** `.github/scripts/deploy.sh` lines 56-71
- Health check failure stops new backend but does not restore previous version
- State file in `/tmp` (line 24) — cleared on reboot, loses deployment state

### ~~[TEST-5] No CI caching~~ FIXED
- Added NuGet and npm caching via actions/cache@v4

---

## HIGH — Frontend

### ~~[FE-1] No error boundaries~~ FIXED
- Added `ErrorBoundary` component wrapping the entire app in `main.tsx`

### ~~[FE-2] Silent failure on all critical user actions~~ PARTIALLY FIXED
- Added error toasts for message send and file upload failures in both DM and guild pages
- `ChannelSidebar.tsx` permission load still fails silently

### ~~[FE-3] Memory leaks: unreleased Object URLs~~ FIXED
- `AttachmentUpload.tsx`: uses ref-based URL map with cleanup on file removal and unmount
- `ProfileSettings.tsx`: revokes previous URL before creating new one

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

### ~~[BE-1] N+1 query risk in hubs~~ FIXED
- DmHub: all sequential `AddToGroupAsync` and presence broadcasts replaced with `Task.WhenAll`
- GuildHub: flattened nested guild→channel loops into single `SelectMany` + `Task.WhenAll`
- Applied to connect, disconnect, and presence broadcasts in both hubs

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

### ~~[BE-7] Missing null checks~~ FIXED
- ThreadController: added null check + return Unauthorized
- DirectMessageChannelController: `m.User?.DisplayName ?? "Unknown"`
- GuildHub: `(g.Channels ?? [])` null guard on SelectMany

### [BE-8] No FluentValidation — validation is manual and duplicated — PARTIALLY FIXED
- ~~Message length and file size limits hardcoded in multiple places~~ → centralized in `Limits.cs`
- No request DTO validation attributes
- FluentValidation not yet added

### ~~[BE-9] No database retry policy~~ FIXED
- Added `EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: 5s)` to UseNpgsql

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

### ~~[FE-9] Missing React.memo on MessageItem~~ FIXED
- Wrapped with `memo()` to prevent unnecessary re-renders

### ~~[FE-10] XSS risk in markdown renderer~~ FIXED
- Link auto-detection now validates URLs with `new URL()` and rejects non-http/https protocols

### [FE-11] Missing client-side form validation — PARTIALLY FIXED
- ~~Login/Register pages missing `required`~~ → added `required` to all inputs
- ~~Register: no length constraints~~ → added `minLength`/`maxLength` on username, `minLength` on password
- `CreateChannelModal.tsx` still has no validation

---

## LOW

### ~~[LOW-1] Docker images unpinned~~ FIXED
- MinIO pinned to `RELEASE.2025-03-12T18-04-18Z`, LiveKit pinned to `v1.8.3`

### ~~[LOW-2] Dockerfile not hardened~~ FIXED
- Added non-root `appuser`, excluded test project from build context

### ~~[LOW-3] No Content Security Policy headers~~ FIXED
- Added CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy via nginx.conf
- Applied to both production and test server blocks

### ~~[LOW-4] setTimeout without cleanup in modals~~ FIXED
- InviteModal now stores timeout ref and clears on unmount

### ~~[LOW-5] Unrevoked audio unlock listeners~~ FIXED
- Listeners now removed after AudioContext enters "running" state

### ~~[LOW-6] Clipboard API not awaited~~ FIXED
- InviteModal.handleCopy now async/awaits clipboard with try/catch

### ~~[LOW-7] Console logging left in production code~~ FIXED
- Removed all 28 `console.log` debug statements; kept `console.warn`/`console.error` for real errors

### ~~[LOW-8] UserId property duplicated across all controllers~~ FIXED
- Created `AuthenticatedController` base class; updated 20 controllers

### ~~[LOW-9] Deploy state file in /tmp~~ FIXED
- Moved to `/var/lib/${PROJECT}/active-slot`

### ~~[LOW-10] Generic client README~~ FIXED
- Removed generic Vite template README from client
- Created proper root README.md with architecture, setup, testing, project structure

---

## Stats

| Category | Critical | High | Medium | Low | Fixed |
|----------|----------|------|--------|-----|-------|
| Category | Critical | High | Medium | Low | Fixed |
|----------|----------|------|--------|-----|-------|
| Security | 0 | — | — | 1 | 4 |
| Architecture | — | 1 | — | — | 2 (ARCH-1, ARCH-3) |
| Testing/CI | — | 3 | — | — | 2 |
| Frontend | — | 3 | 2 | 4 | 7 |
| Backend | — | — | 3 | 0 | 8 |
| Infrastructure | — | — | — | 0 | 9 |
| **Total** | **0** | **7** | **5** | **5** | **32** |
