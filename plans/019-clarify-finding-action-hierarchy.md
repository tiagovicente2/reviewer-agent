# 019 — Clarify finding action hierarchy

- **Status**: TODO
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 4 files, small review-flow reordering plus pure-helper tests

## Problem

Each generated finding puts destructive and publishing actions in the header, before the editable payload and before the focused diff. A user encounters **Publish comment** before seeing the exact comment that will be sent to GitHub.

```tsx
// src/features/reviews/components/EditableFindingCard.tsx:44-70 — current
<HStack justify="space-between" gap="3" alignItems="flex-start">
  <Stack gap="2" minW="0">
    <Badge alignSelf="flex-start" colorPalette={severityColorPalette(finding.severity)}>
      {finding.severity}
    </Badge>
    <Box fontWeight="semibold">{finding.title}</Box>
  </Stack>
  <HStack gap="2">
    <Button
      colorPalette="red"
      disabled={publishing}
      onClick={() => onDiscardFinding?.(finding.id)}
      size="xs"
      variant="outline"
    >
      Discard comment
    </Button>
    <Button
      disabled={!canPublish}
      loading={publishing}
      onClick={() => onPublishFinding?.(publishableFinding)}
      size="xs"
    >
      Publish comment
    </Button>
  </HStack>
</HStack>
```

The editable value appears later:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx:78-93 — current
<Stack gap="2" minW="0">
  <Box color="fg.muted" fontWeight="semibold" textStyle="xs">
    Comment
  </Box>
  <Textarea
    boxSizing="border-box"
    color="fg.default"
    display="block"
    minH="8rem"
    onChange={(event) => setCommentBody(event.target.value)}
    placeholder="Edit the comment before publishing..."
    resize="vertical"
    value={commentBody}
    variant="surface"
    w="100%"
  />
</Stack>
```

The review-level action row has no filled primary action when there are no publishable findings because **Approve** is always outline. When findings exist, **Request changes** is filled, but its relationship to the edited review message and findings below is visually distant.

```tsx
// src/features/reviews/components/review-detail/ReviewTabActions.tsx:32-58 — current
<Button
  disabled={submissionDisabled}
  loading={approving}
  onClick={onApprove}
  size="sm"
  variant="outline"
>
  Approve
</Button>
{hasPublishableFindings ? (
  <Button
    disabled={submissionDisabled}
    loading={requestingChanges}
    onClick={onRequestChanges}
    size="sm"
  >
    Request changes
  </Button>
) : null}
```

These actions cross a trust boundary: `useFindingPublishing` immediately calls `publishReviewComment`, while review submission opens a confirmation dialog. Visual order must encourage review/edit first without weakening the existing confirmation or head-SHA safety checks.

The Doctor report has no action-hierarchy diagnostic. This is a workflow/safety finding beyond the scan.

## Target

Within each finding, present content in this order:

1. severity and title;
2. finding explanation;
3. focused diff/snippet;
4. editable **Comment** payload;
5. file/line and confidence metadata;
6. actions, with one filled primary button: **Publish comment**.

The target footer is exact:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx — target order
<Stack gap="2" minW="0">
  <Box as="label" htmlFor={commentFieldId} color="fg.muted" fontWeight="semibold" textStyle="xs">
    Comment
  </Box>
  <Textarea
    id={commentFieldId}
    boxSizing="border-box"
    color="fg.default"
    display="block"
    minH="8rem"
    onChange={(event) => setCommentBody(event.target.value)}
    placeholder="Edit the comment before publishing..."
    resize="vertical"
    value={commentBody}
    variant="surface"
    w="100%"
  />
</Stack>

<HStack color="fg.muted" justify="space-between" textStyle="xs">
  <Box color="cyan.11">
    {finding.filePath}
    {finding.lineStart ? `:${finding.lineStart}` : ''}
  </Box>
  <Box>{Math.round(finding.confidence * 100)}% confidence</Box>
</HStack>

<HStack gap="2" justify="flex-end">
  <Button
    disabled={publishing}
    onClick={() => onDiscardFinding?.(finding.id)}
    size="sm"
    variant="plain"
  >
    Discard draft
  </Button>
  <Button
    disabled={!publishState.canPublish}
    loading={publishing}
    onClick={() => onPublishFinding?.(publishState.finding)}
    size="sm"
  >
    Publish comment
  </Button>
</HStack>
```

Do not render action buttons in the finding header. **Discard draft** is visually secondary and must not use a red filled treatment; **Publish comment** is the sole filled primary action in that card. Keep both actions explicit—no autosave, auto-publish, swipe action, or menu hiding.

Centralize construction of the outbound payload so the exact edited text, not the original suggestion, is sent:

```ts
// src/features/reviews/components/editableFindingUtils.ts — target
import type { ReviewFinding } from '@/shared/review'

export function getFindingPublishState(finding: ReviewFinding, commentBody: string) {
  const suggestedCommentBody = commentBody.trim()
  return {
    canPublish: Boolean(finding.filePath && finding.lineStart && suggestedCommentBody),
    finding: { ...finding, suggestedCommentBody },
  }
}

export function getPrimaryReviewAction(hasPublishableFindings: boolean) {
  return hasPublishableFindings ? 'request_changes' : 'approve'
}
```

At review level, render exactly one filled primary submission action:

```tsx
// src/features/reviews/components/review-detail/ReviewTabActions.tsx — target hierarchy
<Button disabled={!canExportReview || exporting} onClick={onCopy} size="sm" variant="plain">
  Copy
</Button>
<Button disabled={!canExportReview} loading={exporting} onClick={onExport} size="sm" variant="outline">
  Export
</Button>
{hasPublishableFindings ? (
  <>
    <Button disabled={submissionDisabled} loading={approving} onClick={onApprove} size="sm" variant="outline">
      Approve…
    </Button>
    <Button disabled={submissionDisabled} loading={requestingChanges} onClick={onRequestChanges} size="sm">
      Request changes…
    </Button>
  </>
) : (
  <Button disabled={submissionDisabled} loading={approving} onClick={onApprove} size="sm">
    Approve…
  </Button>
)}
```

The ellipsis signals that submission is not immediate. Preserve `ConfirmSubmitReviewModal` for both review outcomes. Request changes must continue submitting the current `reviewDecisionBody` and the current `publishableFindings`; approve must continue submitting an empty body with no findings.

## Repo conventions to follow

- Keep edited finding text local to `EditableFindingCard`, matching current state ownership at `src/features/reviews/components/EditableFindingCard.tsx:22-28`.
- Keep GitHub side effects in `src/features/reviews/hooks/generated-review/useFindingPublishing.ts:37-63` and `useReviewSubmission.ts:23-58`; UI components only construct/confirm payloads.
- Preserve the existing `Button` variants and loading/disabled conventions.
- Imitate pure utility tests such as `src/features/reviews/components/review-progress/reviewTranscript.test.ts:1-31`; no rendered component harness is present.
- Plan 021 may add associated labels more broadly. The `label`/`htmlFor` pair shown here is part of the final finding-card target and should not be removed if that plan lands first.

## Steps

1. Add `src/features/reviews/components/editableFindingUtils.ts` with `getFindingPublishState` and `getPrimaryReviewAction` exactly as shown. Add `editableFindingUtils.test.ts` proving whitespace is trimmed, edited text replaces the generated suggestion, missing path/line/trimmed body disables publish, and the primary review action is deterministic.
2. At `src/features/reviews/components/EditableFindingCard.tsx:22-100`, replace the inline `canPublish`/`publishableFinding` construction with `getFindingPublishState`. Remove both header actions and reorder explanation, diff, editor, metadata, and footer actions to match Target.
3. Keep the finding editor controlled and visible even when publishing. Disable discard while that finding is publishing, retain loading on publish, and call `onPublishFinding` only from the final primary button with the helper-produced payload.
4. At `src/features/reviews/components/review-detail/ReviewTabActions.tsx:21-60`, implement the exact review-level hierarchy: Copy plain, Export outline, one filled submission action, and ellipses on actions that open confirmation. Preserve all existing callbacks and disabled/loading conditions.
5. Inspect `src/features/reviews/components/ReviewDetail.tsx:91-108` and `:171-190` without changing its workflow. Confirm both actions still set `pendingSubmitAction`, and `confirmSubmitReview` remains the only review-submission path.
6. Re-read the diff and remove unrelated copy or styling changes.

## Boundaries

- Do NOT auto-publish, publish on blur/Enter, or move publishing into an effect.
- Do NOT remove or bypass review submission confirmation.
- Do NOT change `publishReviewComment`, `submitReview`, reviewed-head-SHA validation, API payload shapes, or toast behavior.
- Do NOT make discard the primary/destructive filled action and do not discard while publish is in flight.
- Do NOT combine individual **Publish comment** with **Request changes**; they remain separate existing workflows.
- Do NOT add component/browser tests or a DOM test dependency; add only the Node Vitest pure-helper tests described above.
- STOP if the action/payload code has drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm test -- src/features/reviews/components/editableFindingUtils.test.ts`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` completes and the score does not regress from 81.
- **Runtime workflow check**:
  - Generate a review with at least one publishable finding. Confirm its publish action appears only after the editable comment and there is exactly one filled primary action in the card.
  - Edit the comment by adding leading/trailing spaces and changing its content, click **Publish comment**, and verify GitHub receives the trimmed edited content once.
  - Clear the editor and confirm **Publish comment** disables; restore text and confirm it enables.
  - Confirm **Discard draft** removes only the local finding and cannot fire while that finding is publishing.
  - With findings present, verify **Request changes…** is the sole filled review-level action and still opens the request-changes confirmation. With no findings, verify **Approve…** becomes the sole filled action and still opens approval confirmation.
  - Cancel each confirmation and confirm nothing is sent. Confirm each once and verify the existing body/findings payload and success/error handling remain intact.
- **Done when**: users see and can edit the exact outbound finding payload before its action, each action group has one unambiguous primary next step, all safety gates remain, pure-helper/repository checks pass, and React Doctor does not regress.
