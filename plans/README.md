# React improvement plans

Current audit baseline: commit `4c1804f` plus the worktree snapshot recorded in plans `008`–`013`.

## Execute now

| Order | Plan | Severity | Category | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | [013 — Use GitHub’s aggregate pull request diff](013-use-aggregate-pr-diff.md) | HIGH | Bugs & correctness | DONE | none |
| 2 | [008 — Split review detail tabs by responsibility](008-split-review-detail-tabs.md) | MEDIUM | Maintainability | DONE | none |
| 3 | [011 — Extract finding diff preview logic](011-extract-finding-diff-preview.md) | MEDIUM | Maintainability | DONE | after 008 |
| 4 | [009 — Split generated review workflows](009-split-generated-review-hook.md) | MEDIUM | Maintainability | DONE | after 008 |
| 5 | [010 — Reduce ReviewDetail to orchestration](010-split-review-detail-orchestration.md) | MEDIUM | Maintainability | DONE | after 008 and 009 |

## Execute later

| Order | Plan | Severity | Category | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
| 6 | [012 — Separate review transcript parsing/rendering](012-extract-review-transcript.md) | LOW | Maintainability | DONE | after 008 |
| 7 | [001 — Verify update installer integrity](001-verify-update-installer-integrity.md) | HIGH | Security | TODO/stale audit | reconcile first |
| 8 | [002 — Add pnpm supply-chain hardening](002-add-pnpm-supply-chain-hardening.md) | MEDIUM | Security | TODO/stale audit | reconcile first |
| 9 | [003 — Make clickable toasts keyboard accessible](003-make-clickable-toasts-keyboard-accessible.md) | MEDIUM | Accessibility | TODO/stale audit | reconcile first |
| 10 | [004 — Hoist DiffViewer empty comments default](004-hoist-diff-viewer-empty-comments.md) | MEDIUM | Performance | likely implemented | reconcile first |
| 11 | [006 — Move DiffDisplay utilities](006-move-diff-display-utilities.md) | LOW | Maintainability | likely implemented | reconcile first |
| 12 | [007 — Key CodeTab state reset](007-key-code-tab-state-reset.md) | LOW | Bugs | partially drifted | reconcile first |

Plan `005` is superseded by plan `010`; its cited header and source layout no longer match the current worktree.

## Verification policy

- Do not add frontend component/rendering tests for these plans.
- Add focused Node Vitest coverage for extracted pure helpers.
- Add hook tests only when the existing test environment can exercise them without introducing a browser-testing stack.
- Run `npx react-doctor@latest --scope changed`, typecheck, lint, and the existing test suite after each plan.
- Keep each plan atomic and preserve user-visible behavior unless the plan explicitly fixes a bug.
