# WEAKNESSES

Audit of the Librecord codebase. Fixed items removed. Remaining items organized by priority with implementation plans.

---

## REMAINING (10 items)

### [ARCH-2] Multiple SaveChangesAsync without transactions
- `AttachmentController` creates message then saves attachments separately
- If attachment save fails, orphaned message exists without files
- **Plan:** Move attachment persistence into the `IAttachmentService.SaveAttachmentsAsync` method and wrap both message creation + attachment save in a single transaction at the service layer. Requires `IDbContextTransaction` injection via the repository.
- **Effort:** Medium (1 service + 1 repository change)

### [TEST-1] Zero controller tests
- 24 controllers have no integration test coverage
- Hubs (`DmHub`, `GuildHub`) untested
- **Plan:** Set up `WebApplicationFactory<Program>` test infrastructure with in-memory PostgreSQL (or SQLite). Start with auth endpoints (login/register/refresh), then messaging endpoints. Use `TestServer` for SignalR hub tests.
- **Effort:** Large (test infra setup + ~50 tests)

### [TEST-2] Limited service test coverage
- Only DirectMessageService, GuildChannelMessage, Auth, Friendship have tests
- Missing: PermissionService, ChannelService, PresenceService, VoiceService, UserService, BlockService, PinService, ThreadService, GuildMemberService, GuildSettingsService, AttachmentService, MessageSearchService
- **Plan:** Prioritize by risk — PermissionService first (authorization logic), then PinService and ThreadService (newly created). Follow existing test patterns (Moq + xUnit). Target 80% service coverage.
- **Effort:** Large (~12 test files, ~100 tests)

### [FE-4] No virtual scrolling for message lists
- `MessageList.tsx` renders ALL messages in DOM
- 500+ messages causes visible jank
- **Plan:** Replace the message `.map()` with `@tanstack/react-virtual` (lighter than react-window). Keep the existing infinite scroll sentinel for loading older messages. Requires measuring message heights dynamically since messages vary in size (text, attachments, reactions).
- **Effort:** Large (MessageList rewrite + height estimation)

### [FE-5] Zero accessibility (WCAG non-compliance)
- No `aria-label` on any icon-only button
- No focus trap in modals
- No keyboard navigation for menus/emoji picker
- **Plan:** Phase it:
  1. Add `aria-label` to all icon buttons (GlobalSidebar, MessageItem action buttons, header buttons)
  2. Add `role="dialog"` + focus trap to ConfirmModal and all modal components
  3. Add keyboard navigation (arrow keys) to emoji picker and context menus
  4. Add skip-to-content link and landmark roles
- **Effort:** Large (touches every component, ~30 files)

### [FE-7] Duplicated message logic across pages
- `DmConversationPage.tsx` and `GuildPage.tsx` share ~200 lines of identical logic:
  - `applyNewMessage()` reconciliation
  - Realtime event listeners (new, edited, deleted)
  - Send/edit/delete handlers with optimistic UI
  - Scroll management
- **Plan:** Extract a `useChannelMessages(channelId, hub)` hook that encapsulates all message state, realtime listeners, and CRUD operations. Both pages would consume this hook and only handle page-specific UI (headers, sidebars).
- **Effort:** Large (new hook + refactor both pages)

### [FE-8] Heavy prop drilling
- `GuildPage.tsx` passes 15+ props to `MessageList`
- **Plan:** Create a `MessageListContext` that provides message state, handlers, and user info. MessageList and MessageItem consume via `useContext` instead of props. This naturally follows from [FE-7] — if messages move to a hook, the context wraps the hook's return value.
- **Effort:** Medium (depends on FE-7 being done first)
- **Prerequisite:** FE-7

### [BE-4] No CancellationToken propagation
- No controller or service method accepts `CancellationToken`
- Long-running requests can't be cancelled when client disconnects
- **Plan:** Add `CancellationToken cancellationToken = default` parameter to all service interface methods, then propagate through to repository calls and EF queries (`.ToListAsync(cancellationToken)`). Controllers get the token automatically from ASP.NET. Do it layer by layer: Domain interfaces → Application services → Infra repositories → Controllers.
- **Effort:** Large (every method signature across all layers, ~100 methods)

### [BE-5] Logging in Application/Infrastructure layers
- Only `DirectMessageChannelService` and `SearchController` have `ILogger`
- No audit trail for sensitive operations
- **Plan:** Add `ILogger<T>` to all Application services (12 services). Log at `Information` level for state-changing operations (create, update, delete) and `Warning` for failures. Don't log reads (too noisy). Priority: AuthService, FriendshipService, GuildMemberService, BlockService.
- **Effort:** Medium (~12 files, mechanical)

### [BE-8] Request validation with FluentValidation
- Limits centralized in `Limits.cs` but no request DTO validation
- No validation attributes on request models
- **Plan:** Add `FluentValidation.AspNetCore` NuGet package. Create validators for: `SendMessageRequest`, `RegisterRequest`, `LoginRequest`, `CreateGuildRequest`, `BanRequest`, `CreateThreadRequest`. Register via `AddFluentValidationAutoValidation()`. This replaces manual `if` checks in controllers.
- **Effort:** Medium (1 NuGet + ~10 validator classes)

---

## FIXED (32 items)

- [SEC-1] Rate limiting — global + auth + upload policies with X-Forwarded-For
- [SEC-2] Authorization checks on pins and threads
- [SEC-4] Startup config validation (fail fast)
- [ARCH-1] Direct DbContext in controllers → 10 controllers migrated to services
- [ARCH-3] DM creation race condition → retry on conflict
- [TEST-3] Tests + lint in CI pipeline
- [TEST-5] NuGet + npm caching in CI
- [FE-1] Error boundary wrapping entire app
- [FE-2] Error toasts on message/upload failures
- [FE-3] Memory leaks (Object URL cleanup)
- [FE-6] Optimistic UI error recovery (file restore + reaction rollback)
- [FE-9] React.memo on MessageItem
- [FE-10] XSS in markdown renderer (URL validation)
- [FE-11] Client-side form validation
- [BE-1] N+1 in hubs → Task.WhenAll
- [BE-2] Missing WHERE clause in GetChannelOverridesAsync
- [BE-3] Silent exception swallowing → proper logging
- [BE-7] Missing null checks
- [BE-9] Database retry policy
- [LOW-1] Docker images pinned
- [LOW-2] Dockerfile hardened (non-root user)
- [LOW-3] CSP headers via nginx
- [LOW-4] setTimeout cleanup in InviteModal
- [LOW-5] Audio unlock listeners cleanup
- [LOW-6] Clipboard API awaited
- [LOW-7] Console.log removed from production
- [LOW-8] Base controller for UserId
- [LOW-9] Deploy state file persistent location
- [LOW-10] Proper README

## RESOLVED (not issues)

- [SEC-3] AllowedHosts — Nginx handles host filtering, not the app
- [TEST-4] Deploy rollback — blue-green already handles this implicitly
- [BE-6] Error response formats — consistent after ARCH-1 refactor

---

## Suggested priority order

1. **BE-5** (logging) — mechanical, low risk, high observability value
2. **BE-8** (FluentValidation) — clean validation, removes manual checks
3. **ARCH-2** (transactions) — data integrity fix
4. **FE-5** (accessibility) — can be done incrementally, start with aria-labels
5. **FE-7 → FE-8** (message hook + context) — FE-8 depends on FE-7
6. **FE-4** (virtual scrolling) — perf improvement, only matters at scale
7. **TEST-2** (service tests) — expand coverage incrementally
8. **TEST-1** (controller tests) — needs infra setup first
9. **BE-4** (CancellationToken) — large mechanical refactor, low user impact

## Stats

| Status | Count |
|--------|-------|
| Fixed | 32 |
| Resolved (not issues) | 3 |
| Remaining | 10 |
| **Total audited** | **45** |
