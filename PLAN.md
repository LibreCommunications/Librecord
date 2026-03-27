# PLAN

Prioritized roadmap with remaining codebase weaknesses.

---

## P1 — Code quality (backlog)

### Architecture
- **ARCH-2** Transactions — wrap message+attachment creation in service-layer transaction

### Testing
- **TEST-1** Service test coverage — prioritize PermissionService, PinService, ThreadService

### Frontend patterns
- **FE-4** Virtual scrolling — replace MessageList with @tanstack/react-virtual for 500+ messages
- **FE-5** Accessibility — ARIA labels on icon buttons, focus trap in modals, keyboard nav
- **FE-7** Extract useChannelMessages hook — deduplicate DmConversationPage and GuildPage (~200 lines shared)
- **FE-8** MessageListContext — reduce prop drilling (depends on FE-7)

### Backend patterns
- **BE-4** CancellationToken propagation — add to all service/repo method signatures
- **BE-5** Logging — add ILogger to remaining 10+ services
- **BE-8** FluentValidation — replace manual validation with validator classes
