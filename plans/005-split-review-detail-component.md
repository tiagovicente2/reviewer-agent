# 005 — Split ReviewDetail component responsibilities

- **Status**: SUPERSEDED by `010-split-review-detail-orchestration.md`
- **Commit**: 44835be
- **Severity**: LOW
- **Category**: Maintainability & architecture
- **Rule**: react-doctor/no-giant-component
- **Estimated scope**: 1–3 files, medium refactor

## Problem

`src/features/reviews/components/ReviewDetail.tsx:21` exports a component that spans the review header, instruction loading, generation hooks, export flow, GitHub submit confirmation, tab selection, and modal rendering. React Doctor flags it as a giant component.

```tsx
// src/features/reviews/components/ReviewDetail.tsx:21 — current
export function ReviewDetail({
	colorMode,
	detail,
	detailError,
	detailState,
	onPullRequestDetailRefresh,
	review,
	setSummary,
}: {
	colorMode: ColorMode
	detail: GitHubPullRequestDetails | null
	detailError: string
	detailState: AsyncState
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	review: GitHubReviewRequest | null
	setSummary: (summary: string) => void
}) {
```

The component is central and likely changed often. Smaller sections will reduce review risk and make follow-up fixes easier.

## Target

Canonical recipe from `react-doctor/no-giant-component`:

> Identify the distinct logical sections (header, list, footer, side panel, action bar) and extract each into a focused subcomponent like `<UserHeader />` or `<UserActions />`. Lift shared data fetching and effects into custom hooks. Resist premature splits that obscure data flow; aim for each extracted piece to have a single responsibility.

Suggested repo-specific target:

```tsx
// target shape
export function ReviewDetail(props: ReviewDetailProps) {
	// keep stateful orchestration here
	return (
		<ReviewDetailLayout
			header={<ReviewDetailHeader ... />}
			tabs={<ReviewDetailTabsPanel ... />}
			modal={pendingSubmitAction ? <ConfirmSubmitReviewModal ... /> : null}
		/>
	)
}
```

At minimum extract:

- `ReviewDetailHeader` for PR metadata, instructions select, Generate/Open buttons, and `detailError` display.
- `ReviewTabActions` for Copy/Export/Approve/Request changes buttons.
- Keep `ConfirmSubmitReviewModal` as a local component unless moving it reduces the file substantially.

## Repo conventions to follow

- Preserve existing local components and naming style in `ReviewDetail.tsx`.
- Continue importing `CodeTab`, `ReviewTab`, and `SummaryTab` from `./ReviewDetailTabs`.
- Imitate focused component props from `src/features/reviews/components/ReviewDetailTabs.tsx`.

## Steps

1. Define an explicit `ReviewDetailProps` type to reduce repeated inline prop type noise.
2. Extract `ReviewDetailHeader` from the JSX beginning at the top bar (`<Box bg="gray.1" px="8" py="3">`). Pass only the values and callbacks it uses.
3. Extract `ReviewTabActions` from the action button group rendered when `activeTab === 'review' && generatedReview`.
4. Re-read the diff and ensure state ownership remains in `ReviewDetail`; do not move logic unless it makes data flow clearer.
5. Do not change visual layout, button labels, loading states, or submit behavior.

## Boundaries

- Do NOT change public props of `ReviewDetail`.
- Do NOT change review generation, publish, export, or submit behavior.
- Do NOT split so aggressively that props become harder to follow.
- STOP if `ReviewDetail.tsx` has drifted from commit `44835be`.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears or reduces `react-doctor/no-giant-component` without lowering the score.
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
- **Behavior check**: Select a PR, switch Summary/Code/Review tabs, generate a review, copy/export it, approve/request changes through the confirmation modal, and confirm behavior is unchanged.
- **Done when**: `ReviewDetail` is materially smaller, responsibilities are named, and checks pass.
