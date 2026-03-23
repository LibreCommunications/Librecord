# PLAN

Prioritized roadmap combining open GitHub issues and remaining codebase weaknesses.

---

## P0 — Bugs (fix now)

### Messaging bugs
- ~~**#45** New message bubbles inconsistent~~ — **Fixed.** Unread badges now clear from state on nav; instant scroll on initial load; skip badge for prepended (older) messages; fixed handleLoadMore race condition on channel switch
- ~~**#44** Guild reaction resets chat position~~ — **Fixed.** Added realtime reaction events via SignalR (channel:reaction:added/removed); reactions now sync across users without refresh
- ~~**#32** New DM from unknown user~~ — **Fixed.** Backend now notifies both sender and target via `dm:channel:created`; sidebar re-fetches on ping for closed DMs
- **#49** Bugged conversation if alone — group DM with no other members shows raw ID string in sidebar
- **#48** File too big shows wrong fail message — >100MB upload shows generic error instead of size-specific message
- **#31** DM scroll position — resets to last text message instead of last item (media)

### Pin bugs
- **#15** Pin message content not showing — decryption fix deployed, needs verification
- **#40** Pinning in DM not available — pin UI missing from DM conversation page (labeled "invalid")

### Voice/Screenshare bugs
- **#8** Voice channel renders as text channel — channel type detection issue
- **#10** Screenshare won't stop (black screen after closing) — LiveKit track cleanup
- **#28** Screenshare crashes on YouTube — likely DRM/codec issue, needs investigation

### Upload bugs
- **#33** File upload timeout/crash — 60s timeout added, needs testing (labeled "invalid")

---

## P1 — Features (next sprint)

### Social
- ~~**#21** Cancel friend request~~ — **Done.** Cancel button on outgoing requests, realtime sync to both users
- ~~**#39** Delete friend's DM~~ — **Done.** Close button removed from 1-on-1 DMs; DM reappears when new message arrives

### Guild management
- **#18** Kick/Ban UI — backend exists, need frontend buttons in member list
- **#17** Assign role to member — UI to assign roles in member list
- **#16** Role permission enforcement — permissions not actually checked, can manage even when off
- **#13** Channel edit/delete settings — no way to manage channels after creation
- **#12** Server settings accessibility — can't access settings without being in a channel first

### Messaging features
- **#43** Reply system — reply to specific message with highlight/quote
- **#42** Thread UI — backend complete, wire up ThreadPanel to GuildPage
- ~~**#34** Reaction popup z-index~~ — **Fixed.** z-index corrected, E2E test updated

### Upload UX
- ~~**#35** File upload loading indicator~~ — **Done.** "Uploading..." indicator, verified by E2E
- ~~**#36** File lost on refresh~~ — **Done.** beforeunload warning, verified by E2E
- ~~**#37** Failed upload toast~~ — **Done.** Error toast on failed upload, verified by E2E

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
1. ~~#45 (unread badges) + #44 (reaction scroll)~~ — **Done**
2. #49 (solo group DM display) + #48 (file size error message) — quick fixes
3. #40 (DM pins missing) + #15 (pin content) — pin system broken
4. #31 (DM scroll position)

**Week 2 — Features users are asking for:**
1. ~~#21 (cancel friend request) + #39 (delete DM)~~ — **Done**
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
