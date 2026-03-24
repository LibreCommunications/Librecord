---
name: Never disable ESLint rules
description: User demands production-grade code — never use eslint-disable comments, fix the root cause instead
type: feedback
---

Never use `// eslint-disable-next-line` or `// eslint-disable` comments. ESLint errors must be fixed properly by addressing the root cause — memoize with useCallback, restructure code, fix types, etc. No shortcuts.

**Why:** The user wants production-grade code. ESLint rules exist for a reason and suppressing them hides real issues.

**How to apply:** When ESLint flags something, fix the underlying code pattern instead of silencing the warning. For React hooks exhaustive-deps, wrap functions in useCallback. For no-explicit-any, use proper types. For set-state-in-effect, restructure the data fetching pattern.
