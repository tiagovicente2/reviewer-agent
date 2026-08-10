# 010 — Reduce ReviewDetail to screen orchestration

- **Status**: DONE
- **Commit**: `4c1804f`
- **Worktree snapshot**: `99c3495697f4f9fd94775b41b9a64c2f6a9372c7a24f45f80995c95f2813f1e5`
- **Severity**: MEDIUM
- **Category**: Maintainability & architecture
- **Rule**: Beyond the scan
- **Estimated scope**: 5–7 files, medium refactor

## Problem

`src/features/reviews/components/ReviewDetail.tsx:23-394` currently owns screen layout and several independent workflows:

```tsx
const [activeTab, setActiveTab] = useState<TabId>('summary')
const [pendingSubmitAction, setPendingSubmitAction] = useState(...)
const [exportState, setExportState] = useState(...)
const [reviewDecisionBody, setReviewDecisionBody] = useState('')
const [instructions, setInstructions] = useState(...)

useEffect(() => appRpc.request.getAppSettings() ...)
const confirmSubmitReview = () => ...
const copyReviewToClipboard = async () => ...
const saveReviewToFile = async () => ...
```

It also declares the confirmation modal and all Review-tab action buttons. The existing `plans/005-split-review-detail-component.md` is stale: it references commit `44835be` and asks to extract a header that is already in `ReviewDetailHeader.tsx`.

## Target

Keep `ReviewDetail` as the composition root only:

```tsx
export function ReviewDetail(props: ReviewDetailProps) {
  const instructions = useReviewerInstructions()
  const reviewExport = useReviewExport({ detail, generatedReview })
  // retain cross-section state and compose header, tab shell, and modal
}
```

Create:

```text
hooks/useReviewerInstructions.ts
hooks/useReviewExport.ts
components/review-detail/ReviewTabActions.tsx
components/review-detail/ConfirmSubmitReviewModal.tsx
```

`ReviewDetail` should continue to own active-tab selection, pending action identity, and composition because those coordinate multiple child areas.

## Repo conventions to follow

- Imitate cancellation in `usePullRequestDetails.ts` for settings loading.
- Imitate async error/state return shapes in `usePullRequestDiff.ts` for export state.
- Keep focused presentation components in `components`, workflows in `hooks`.
- Build on plan `008` direct tab imports and plan `009` hook facade if those plans execute first.

## Steps

1. Replace inline `ReviewDetail` prop typing with a named `ReviewDetailProps` type.
2. Extract settings instruction loading and selected-instruction normalization into `useReviewerInstructions.ts`. Return `instructions`, `selectedInstructionId`, and `setSelectedInstructionId`.
3. Extract clipboard copy, file export, `exportState`, and `exportError` into `useReviewExport.ts`. Keep toast behavior and `formatReviewForExport` usage unchanged.
4. Move the Review-tab button group into `ReviewTabActions.tsx`. Pass semantic values/callbacks rather than entire hook result objects.
5. Move `ConfirmSubmitReviewModal` and `PendingSubmitAction` into `ConfirmSubmitReviewModal.tsx`.
6. Keep `confirmSubmitReview` in `ReviewDetail` because it combines pending modal state, decision body, findings, and submission workflow; pass its final callback to the modal.
7. Preserve the current keyed `CodeTab`, tab display strategy, header, and empty state.
8. Supersede old plan `005` in `plans/README.md` once this plan is implemented.

## Boundaries

- Do NOT move all state into one mega controller hook.
- Do NOT change `ReviewDetail` public props, visual layout, button labels, modal text, or submission behavior.
- Do NOT add component tests. Existing mechanical checks and manual behavior verification are sufficient; pure helper tests may be added if extraction introduces helpers.
- Do NOT combine this with generated-review workflow changes beyond imports from plan `009`.
- STOP on source drift from the stamped snapshot.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `npx react-doctor@latest --scope changed` does not regress.
- **Behavior check**: Switch all tabs; choose reviewer instructions; generate; copy/export; trigger/cancel/confirm approve and request-changes modals; verify all loading/error states.
- **Done when**: `ReviewDetail` reads as screen composition, workflows have focused owners, old plan `005` is superseded, and behavior remains unchanged.
