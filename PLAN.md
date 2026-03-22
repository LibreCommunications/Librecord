# PLAN

Prioritized roadmap combining open GitHub issues and remaining codebase weaknesses.

---

## P0 — Bugs (fix now)

### Messaging bugs
- **#45** New message bubbles inconsistent — unread badges appear/disappear unreliably, persist after reading
- **#44** Guild reaction resets chat position — adding/removing reaction scrolls to bottom after refresh
- **#31** DM scroll position — resets to last text message instead of last item (media)
- **#32** New DM from unknown user — first message from new user doesn't appear (partially fixed, needs testing)

### Pin bugs
- **#15** Pin message content not showing — decryption fix deployed, needs verification
- **#40** Pinning in DM not available — pin UI missing from DM conversation page

### Voice/Screenshare bugs
- **#8** Voice channel renders as text channel — channel type detection issue
- **#10** Screenshare won't stop (black screen after closing) — LiveKit track cleanup
- **#28** Screenshare crashes on YouTube — likely DRM/codec issue, needs investigation

### Upload bugs
- **#47** Cancel button on refresh warning breaks file upload — `sending` state stuck after beforeunload cancel
- **#33** File upload timeout/crash — 60s timeout added, needs testing
- **#46** AudioContext warning on keypress — harmless browser warning, mark as wontfix

---

## P1 — Features (next sprint)

### Social
- **#21** Cancel friend request — add cancel button on outgoing requests
- **#39** Delete friend's DM — button to remove 1-on-1 DM from sidebar

### Guild management
- **#18** Kick/Ban UI — backend exists, need frontend buttons in member list
- **#17** Assign role to member — UI to assign roles in member list
- **#16** Role permission enforcement — permissions not actually checked, can manage even when off
- **#13** Channel edit/delete settings — no way to manage channels after creation
- **#12** Server settings accessibility — can't access settings without being in a channel first

### Messaging features
- **#43** Reply system — reply to specific message with highlight/quote
- **#42** Thread UI — backend complete, wire up ThreadPanel to GuildPage
- **#34** Reaction popup z-index — popup overflows below message input

### Upload UX
- **#35** File upload loading indicator — "Uploading..." added, needs testing
- **#36** File lost on refresh — beforeunload warning added, needs testing
- **#37** Failed upload toast — error toast added, needs testing

---

## P2 — Code quality (backlog)

### Architecture
- **ARCH-2** Transactions — wrap message+attachment creation in service-layer transaction

### Testing
- **TEST-1** Controller integration tests — set up WebApplicationFactory, start with auth endpoints
- **TEST-2** Service test coverage — prioritize PermissionService, PinService, ThreadService

### Frontend patterns
- **FE-4** Virtual scrolling — replace MessageList with @tanstack/react-virtual for 500+ messages
- **FE-5** Accessibility — ARIA labels on icon buttons, focus trap in modals, keyboard nav
- **FE-7** Extract useChannelMessages hook — deduplicate DmConversationPage and GuildPage (~200 lines shared)
- **FE-8** MessageListContext — reduce prop drilling (depends on FE-7)

### Backend patterns
- **BE-4** CancellationToken propagation — add to all service/repo method signatures
- **BE-5** Logging — add ILogger to remaining 10+ services
- **BE-8** FluentValidation — replace manual validation with validator classes

---

## Suggested work order

**Week 1 — Critical bugs:**
1. #45 (unread badges) + #44 (reaction scroll) — both affect daily usage
2. #40 (DM pins missing) + #15 (pin content) — pin system broken
3. #47 (upload cancel stuck) — blocks file uploads after cancel

**Week 2 — Features users are asking for:**
1. #21 (cancel friend request) + #39 (delete DM)
2. #18 + #17 (kick/ban + role assignment) — guild management basics
3. #13 + #12 (channel settings + server settings access)

**Week 3 — Voice/screenshare + messaging features:**
1. #8 + #10 (voice channel + screenshare fixes)
2. #42 (thread UI wiring)
3. #43 (reply system)

**Ongoing — Code quality:**
- TEST-2 incrementally (add tests when touching a service)
- FE-5 incrementally (add aria-labels when touching a component)
- BE-5 incrementally (add ILogger when touching a service)
