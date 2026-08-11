# React improvement plans

Current UX/UI audit baseline: commit `a283d84`.

## Completed UX/UI audit

| Order | Plan | Severity | Category | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | [015 — Isolate generation by pull request](015-isolate-generation-by-pull-request.md) | HIGH | Bugs & correctness | DONE | none |
| 2 | [018 — Make the review workspace adaptive](018-make-review-workspace-adaptive.md) | HIGH | Accessibility | DONE | none |
| 3 | [020 — Add accessible modal behavior](020-add-accessible-modal-behavior.md) | HIGH | Accessibility | DONE | none |
| 4 | [022 — Show inbox error state](022-show-inbox-error-state.md) | HIGH | Bugs & correctness | DONE | none |
| 5 | [023 — Fix settings responsive scrolling](023-fix-settings-responsive-scrolling.md) | HIGH | Bugs & correctness | DONE | none |
| 6 | [026 — Improve long-form markdown typography](026-improve-long-form-typography.md) | MEDIUM | Accessibility | DONE | none |
| 7 | [014 — Preserve edited review comments](014-preserve-edited-review-comments.md) | HIGH | Bugs & correctness | DONE | after 015 |
| 8 | [021 — Add accessible control semantics](021-add-accessible-control-semantics.md) | HIGH | Accessibility | DONE | after 020 |
| 9 | [024 — Guard unsaved settings changes](024-guard-unsaved-settings.md) | HIGH | Bugs & correctness | DONE | after 020 and 023 |
| 10 | [025 — Confirm destructive cache clearing](025-confirm-cache-clearing.md) | HIGH | Bugs & correctness | DONE | after 020 |
| 11 | [016 — Reconcile published findings](016-reconcile-published-findings.md) | HIGH | Bugs & correctness | DONE | after 014 |
| 12 | [019 — Clarify finding action hierarchy](019-clarify-finding-action-hierarchy.md) | HIGH | Bugs & correctness | DONE | after 014 and 016 |
| 13 | [027 — Improve async accessibility](027-improve-async-accessibility.md) | HIGH | Accessibility | DONE | after 021 |
| 14 | [017 — Lock review submission](017-lock-review-submission.md) | HIGH | Bugs & correctness | DONE | after 014 and 016 |

## Completed previous audit

| Order | Plan | Severity | Category | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | [013 — Use GitHub’s aggregate pull request diff](013-use-aggregate-pr-diff.md) | HIGH | Bugs & correctness | DONE | none |
| 2 | [008 — Split review detail tabs by responsibility](008-split-review-detail-tabs.md) | MEDIUM | Maintainability | DONE | none |
| 3 | [011 — Extract finding diff preview logic](011-extract-finding-diff-preview.md) | MEDIUM | Maintainability | DONE | after 008 |
| 4 | [009 — Split generated review workflows](009-split-generated-review-hook.md) | MEDIUM | Maintainability | DONE | after 008 |
| 5 | [010 — Reduce ReviewDetail to orchestration](010-split-review-detail-orchestration.md) | MEDIUM | Maintainability | DONE | after 008 and 009 |
| 6 | [012 — Separate review transcript parsing/rendering](012-extract-review-transcript.md) | LOW | Maintainability | DONE | after 008 |

## Stale audit backlog

| Order | Plan | Severity | Category | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
| 7 | [001 — Verify update installer integrity](001-verify-update-installer-integrity.md) | HIGH | Security | TODO/stale audit | reconcile first |
| 8 | [002 — Add pnpm supply-chain hardening](002-add-pnpm-supply-chain-hardening.md) | MEDIUM | Security | TODO/stale audit | reconcile first |
| 9 | [003 — Make clickable toasts keyboard accessible](003-make-clickable-toasts-keyboard-accessible.md) | MEDIUM | Accessibility | superseded by 027 | none |
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
