# 026 — Improve long-form markdown typography

- **Status**: TODO
- **Commit**: `a283d84`
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small shared-style change

## Problem

All markdown heading levels currently share one style, so document hierarchy is visible in the source but flattened on screen:

```tsx
// src/components/markdown/MarkdownContent.tsx:14-25 — current
const markdownContentClassName = css({
	color: 'fg.muted',
	lineHeight: '1.7',
	textStyle: 'sm',
	'& h1, & h2, & h3, & h4': {
		color: 'fg.default',
		fontWeight: 'semibold',
		marginBottom: '2',
		marginTop: '4',
	},
	'& p': { marginY: '2' },
	'& ul, & ol': { marginY: '2', paddingLeft: '5' },
```

Long paragraphs also span the full available card width. The shared renderer is used for pull request summaries, generated findings, and settings instruction previews:

```tsx
// src/features/reviews/components/review-tabs/summary/SummaryTab.tsx:35-39 — current
<Card.Body minH="0" overflow="hidden">
	<Box h="100%" minH="0" overflowY="auto" pr="3" scrollbarGutter="stable">
		<MarkdownContent>
			{detail?.body || 'This pull request does not include a description.'}
		</MarkdownContent>
	</Box>
</Card.Body>
```

```tsx
// src/features/reviews/components/EditableFindingCard.tsx:43-72 — current
<Stack gap="3">
	<HStack justify="space-between" gap="3" alignItems="flex-start">
		{/* finding metadata and actions */}
	</HStack>
	<MarkdownContent>{finding.body}</MarkdownContent>
</Stack>
```

```tsx
// src/features/settings/components/ReviewerInstructionsCard.tsx:121-130 — current
<Box
	bg="gray.2"
	borderRadius="l2"
	display={mode === 'preview' ? 'block' : 'none'}
	h="100%"
	minH="0"
	overflowY="auto"
	p="4"
>
	<MarkdownContent>{selected?.content || '_No instructions yet._'}</MarkdownContent>
</Box>
```

The same renderer deliberately gives tables and fenced code their own full-width horizontal overflow:

```tsx
// src/components/markdown/MarkdownContent.tsx:35-53 — current
'& pre': {
	backgroundColor: 'gray.2',
	borderRadius: 'l2',
	overflowX: 'auto',
	padding: '3',
},
'& pre code': { backgroundColor: 'transparent', padding: '0' },
'& blockquote': {
	borderLeftColor: 'cyan.8',
	borderLeftWidth: '3px',
	color: 'fg.muted',
	paddingLeft: '3',
},
'& table': {
	borderCollapse: 'collapse',
	display: 'block',
	overflowX: 'auto',
	width: '100%',
},
```

A blanket `maxWidth` on the markdown root, `pre`, or `table` would make prose easier to read by shrinking the very content that needs horizontal space. The measure must target prose flow elements only.

## Target

Replace the grouped heading declaration with distinct levels and constrain only direct prose-flow children to a readable `72ch` measure:

```tsx
// src/components/markdown/MarkdownContent.tsx:14-65 — target
const markdownContentClassName = css({
	color: 'fg.muted',
	lineHeight: '1.7',
	textStyle: 'sm',
	'& > :where(h1, h2, h3, h4, p, ul, ol, blockquote)': {
		maxWidth: '72ch',
	},
	'& h1, & h2, & h3, & h4': {
		color: 'fg.default',
		fontWeight: 'semibold',
		marginBottom: '2',
	},
	'& h1': { marginTop: '7', textStyle: '2xl' },
	'& h2': { marginTop: '6', textStyle: 'xl' },
	'& h3': { marginTop: '5', textStyle: 'lg' },
	'& h4': { marginTop: '4', textStyle: 'md' },
	'& p': { marginY: '2' },
	'& ul, & ol': { marginY: '2', paddingLeft: '5' },
	'& li': { marginY: '1' },
	'& a': { color: 'cyan.11', textDecoration: 'underline' },
	'& code': {
		backgroundColor: 'gray.3',
		borderRadius: 'l1',
		color: 'fg.default',
		fontFamily: 'mono',
		paddingX: '1',
	},
	'& pre': {
		backgroundColor: 'gray.2',
		borderRadius: 'l2',
		maxWidth: '100%',
		overflowX: 'auto',
		padding: '3',
	},
	'& pre code': { backgroundColor: 'transparent', padding: '0' },
	'& blockquote': {
		borderLeftColor: 'cyan.8',
		borderLeftWidth: '3px',
		color: 'fg.muted',
		paddingLeft: '3',
	},
	'& table': {
		borderCollapse: 'collapse',
		display: 'block',
		maxWidth: '100%',
		overflowX: 'auto',
		width: '100%',
	},
	'& th, & td': { borderColor: 'border.default', borderWidth: '1px', padding: '2' },
	'& img': { borderRadius: 'l2', maxWidth: '100%', marginY: '3' },
	'& details': {
		backgroundColor: 'gray.2',
		borderColor: 'border.default',
		borderRadius: 'l2',
		borderWidth: '1px',
		marginY: '3',
		padding: '3',
	},
	'& summary': { color: 'fg.default', cursor: 'pointer', fontWeight: 'semibold' },
})
```

The direct-child selector intentionally excludes `pre`, `table`, `img`, and `details`. Keep GitHub review comments compact and unchanged by overriding only the new prose measure in the comment tone:

```tsx
// src/components/markdown/MarkdownContent.tsx:67-90 — target addition
const commentMarkdownContentClassName = css({
	color: 'black',
	'& > :where(h1, h2, h3, h4, p, ul, ol, blockquote)': {
		maxWidth: 'none',
	},
	'& h1, & h2, & h3, & h4': {
		color: 'black',
	},
	// preserve every remaining existing comment-tone override
})
```

No caller change is required: default-tone instances are exactly the summary, finding, and settings-preview contexts, while `ReviewCommentAnnotation` passes `tone="comment"`.

## Repo conventions to follow

- Keep shared markdown styling in `MarkdownContent`; do not duplicate typography in three feature components.
- Continue using Panda tokens and `textStyle` values already used elsewhere (`2xl`, `xl`, `lg`, `md`).
- Preserve `react-markdown`, `remark-gfm`, image proxying, and comment-tone ownership.
- Preserve the existing horizontal-overflow treatment for GFM tables and fenced code.

## Steps

1. At `src/components/markdown/MarkdownContent.tsx:18-23`, retain shared heading color/weight/margin-bottom, then add exact `h1` through `h4` size and top-spacing declarations.
2. Add the direct-child `72ch` selector for headings, paragraphs, lists, and blockquotes; do not apply it to the root or to `pre`, `table`, images, and details.
3. Add explicit `maxWidth: '100%'` to `pre` and `table` while preserving their current `overflowX="auto"` behavior.
4. At `src/components/markdown/MarkdownContent.tsx:67`, override the prose measure to `none` for `tone="comment"` without flattening the new heading hierarchy or changing comment colors.
5. Re-read the generated CSS/diff and remove unrelated markdown renderer or feature-component churn.

## Boundaries

- Do NOT truncate, line-clamp, center, or globally narrow the markdown root.
- Do NOT constrain `pre`, `table`, images, or details to `72ch`; code and tables must retain the available card width and horizontal scrolling.
- Do NOT change markdown parsing, HTML element mapping, links, image loading, or sanitization behavior.
- Do NOT edit SummaryTab, EditableFindingCard, ReviewerInstructionsCard, or comment markup; the shared style is the intended seam.
- Do NOT add snapshot/component/browser tests or dependencies. STOP if `MarkdownContent.tsx` has drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostics and no score regression.
- **Behavior check**: Render one markdown fixture containing `#` through `####`, long paragraphs, nested lists, a blockquote, a wide GFM table, a long unbroken fenced-code line, an image, and details in (1) Pull request summary, (2) a generated finding, and (3) Settings Preview. Confirm heading levels are visibly distinct and prose stops at roughly 72 characters while code/table containers still use the full card width and scroll horizontally.
- **Regression check**: Open an inline GitHub review comment and confirm comment colors and available width are unchanged; headings still communicate hierarchy.
- **Zoom check**: At 200% zoom, confirm prose wraps without horizontal page overflow and wide code/tables remain reachable through their own horizontal scrollbar.
- **Done when**: summary, finding, and settings-preview prose has distinct heading hierarchy and readable measure without reducing code/table usability.
