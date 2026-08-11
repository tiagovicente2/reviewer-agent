# 021 — Add accessible control semantics

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: `react-doctor/control-has-associated-label`; Beyond the scan
- **Estimated scope**: 11 files, medium shared-control and semantic markup change

## Problem

### The two tab sets are only styled buttons

The primary review views have no `tablist`, `tab`, or `tabpanel` relationships. Every button remains in the Tab order, and Left/Right/Home/End do nothing:

```tsx
// src/features/reviews/components/ReviewDetail.tsx:153-169,186-204 — current
<Card.Root bg="transparent" h="100%" minH="0" overflow="hidden" variant="subtle">
	<Card.Header p="0" pb="2">
		<HStack justify="space-between" gap="3" w="100%">
			<HStack gap="0.5" p="0.5" bg="gray.2" borderRadius="l1" width="fit-content">
				<TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>
					Summary
				</TabButton>
				<TabButton active={activeTab === 'code'} onClick={() => setActiveTab('code')}>
					Code
				</TabButton>
				<TabButton active={activeTab === 'review'} onClick={() => setActiveTab('review')}>
					Review
				</TabButton>
			</HStack>
			{/* ... */}
		</HStack>
	</Card.Header>
	<Card.Body minH="0" overflow="hidden" p="0">
		<Box display={activeTab === 'code' ? 'block' : 'none'} h="100%" minH="0">
			<CodeTab /* ... */ />
		</Box>
		<Box display={activeTab === 'summary' ? 'block' : 'none'} h="100%" minH="0">
			<SummaryTab detail={detail} detailState={detailState} />
		</Box>
		<Box display={activeTab === 'review' ? 'block' : 'none'} h="100%" minH="0">
			{/* ... */}
		</Box>
	</Card.Body>
</Card.Root>
```

Settings repeats this pattern for Raw/Preview and hides content only with CSS:

```tsx
// src/features/settings/components/ReviewerInstructionsCard.tsx:63-75,107-131 — current
<HStack justify="space-between" gap="4">
	<Box minW="0">
		<Card.Title>Reviewer agent instructions</Card.Title>
		<Card.Description>{path}</Card.Description>
	</Box>
	<HStack gap="1" p="0.5" bg="gray.2" borderRadius="l1" flexShrink="0">
		<TabButton active={mode === 'raw'} onClick={() => onChangeMode('raw')}>Raw</TabButton>
		<TabButton active={mode === 'preview'} onClick={() => onChangeMode('preview')}>Preview</TabButton>
	</HStack>
</HStack>
{/* ... */}
<Card.Body minH="0" overflow="hidden">
	<Box display={mode === 'raw' ? 'block' : 'none'} h="100%" minH="0">
		<Textarea /* ... */ />
	</Box>
	<Box display={mode === 'preview' ? 'block' : 'none'} /* ... */>
		<MarkdownContent>{selected?.content || '_No instructions yet._'}</MarkdownContent>
	</Box>
</Card.Body>
```

`TabButton` itself exposes only visual state:

```tsx
// src/components/common.tsx:26-57 — current
export function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<Box
			as="button"
			onClick={onClick}
			className={css({
				// ...
				backgroundColor: active ? 'gray.1' : 'transparent',
				color: active ? 'fg.default' : 'fg.muted',
			})}
		>
			{children}
		</Box>
	)
}
```

### The shared Select is not a listbox

`Select` is a disclosure button followed by unrelated buttons. It has `aria-expanded`, but no combobox/listbox/option relationship, active descendant, selected state, typeahead, Arrow/Home/End navigation, Escape handling, or focus return:

```tsx
// src/components/ui/select.tsx:45-52,70-103,118-124 — current
<Box position="relative" ref={ref} flexShrink="0" w={width}>
	<button
		type="button"
		aria-busy={loading}
		aria-expanded={open}
		disabled={disabled}
		title={loading ? 'Loading…' : undefined}
		{/* ... */}
		onClick={() => {
			if (!disabled) setOpen((current) => !current)
		}}
	>
		{/* selected text */}
	</button>
	{open ? (
		<Box /* visual popup only */>
			{options.map((option) => (
				<button
					key={optionValue(option)}
					type="button"
					title={optionLabel(option)}
					onClick={() => {
						onChange(optionValue(option))
						setOpen(false)
					}}
				>
					{optionLabel(option)}
				</button>
			))}
		</Box>
	) : null}
</Box>
```

This shared control is used for inbox search mode, generation instructions, instruction editing, color mode, agent, model, and review language. Keyboard and screen-reader failure therefore affects hot paths rather than a cold settings edge.

### Hot-path fields rely on placeholders or adjacent text

The inbox search input has an `id` but no label:

```tsx
// src/features/reviews/components/inbox/ReviewSearchBar.tsx:42-59 — current
<Select
	value={searchMode}
	width="5.75rem"
	onChange={(mode) => setSearchMode(mode as SearchMode)}
	options={Object.entries(searchModeLabels).map(([value, label]) => ({ value, label }))}
/>
<Box position="relative" minW="0">
	<Input
		id="review-search"
		onChange={(event) => setQuery(event.target.value)}
		{/* ... */}
		placeholder={searchPlaceholders[searchMode]}
		value={query}
	/>
```

The review message looks labelled visually, but the text is a `div`, not a label:

```tsx
// src/features/reviews/components/GeneratedFindings.tsx:123-142 — current
<Stack gap="2" bg="gray.2" borderRadius="l2" p="4">
	<Stack gap="1">
		<Box fontWeight="semibold">Review message</Box>
		<Box color="fg.muted" textStyle="sm">{/* help text */}</Box>
	</Stack>
	<Textarea
		onChange={(event) => setReviewDecisionBody(event.target.value)}
		placeholder="Add an optional review summary for GitHub..."
		value={reviewDecisionBody}
		{/* ... */}
	/>
</Stack>
```

Instruction name/content, review export folder, and finding comment use the same placeholder/adjacent-text pattern. A placeholder disappears after entry and is not a substitute for a persistent name.

The canonical React Doctor `control-has-associated-label` fix for this stamped plan is:

> Give the control a persistent accessible name. Prefer visible text or an associated `<label>`; use `aria-label` for a truly icon-only control. A native `title` may satisfy this detector but is a weak sole name. Verify name, role, state, and value in the rendered accessibility tree.

Source: `https://www.react.doctor/prompts/rules/react-doctor/control-has-associated-label.md`, fetched while planning commit `a283d84`. Apply the preferred associated-label branch below; do not silence the rule with `title` or add `aria-label` to visible text fields.

## Target

### Use Ark Tabs for both tab sets

Build the existing visual `TabButton` on Ark's installed Tabs trigger. Ark supplies `tab`, `aria-selected`, generated `aria-controls`/`aria-labelledby`, one roving tab stop, automatic Left/Right/Home/End navigation, and focus movement:

```tsx
// src/components/common.tsx — target TabButton
import { Tabs } from '@ark-ui/react/tabs'

export function TabButton({ children, value }: { children: ReactNode; value: string }) {
	return (
		<Tabs.Trigger
			value={value}
			className={css({
				paddingX: '3',
				paddingY: '1.5',
				borderRadius: 's',
				fontSize: 'sm',
				fontWeight: 'medium',
				transition: 'all 150ms ease',
				cursor: 'pointer',
				backgroundColor: 'transparent',
				color: 'fg.muted',
				border: 'none',
				'&[data-selected]': { backgroundColor: 'gray.1', color: 'fg.default' },
				_hover: { backgroundColor: 'gray.3', color: 'fg.default' },
			})}
		>
			{children}
		</Tabs.Trigger>
	)
}
```

Wrap the review card in a controlled root and replace CSS-only panels with Ark content while preserving mounted state:

```tsx
// src/features/reviews/components/ReviewDetail.tsx — target semantic shape
<Tabs.Root
	lazyMount={false}
	onValueChange={({ value }) => setActiveTab(value as TabId)}
	unmountOnExit={false}
	value={activeTab}
>
	<Card.Root bg="transparent" h="100%" minH="0" overflow="hidden" variant="subtle">
		<Card.Header p="0" pb="2">
			<HStack justify="space-between" gap="3" w="100%">
				<Tabs.List aria-label="Pull request review views" asChild>
					<HStack gap="0.5" p="0.5" bg="gray.2" borderRadius="l1" width="fit-content">
						<TabButton value="summary">Summary</TabButton>
						<TabButton value="code">Code</TabButton>
						<TabButton value="review">Review</TabButton>
					</HStack>
				</Tabs.List>
				{/* existing ReviewTabActions condition */}
			</HStack>
		</Card.Header>
		<Card.Body minH="0" overflow="hidden" p="0">
			<Tabs.Content asChild value="code">
				<Box h="100%" minH="0"><CodeTab /* unchanged props */ /></Box>
			</Tabs.Content>
			<Tabs.Content asChild value="summary">
				<Box h="100%" minH="0"><SummaryTab detail={detail} detailState={detailState} /></Box>
			</Tabs.Content>
			<Tabs.Content asChild value="review">
				<Box h="100%" minH="0">{/* existing export error and ReviewTab */}</Box>
			</Tabs.Content>
		</Card.Body>
	</Card.Root>
</Tabs.Root>
```

Use the same exact primitive relationship for settings:

```tsx
// src/features/settings/components/ReviewerInstructionsCard.tsx — target semantic shape
<Tabs.Root
	lazyMount={false}
	onValueChange={({ value }) => onChangeMode(value as InstructionsMode)}
	unmountOnExit={false}
	value={mode}
>
	<Card.Root /* current/plan-023 layout props */>
		<Card.Header>
			<HStack justify="space-between" gap="4">
				{/* existing title */}
				<Tabs.List aria-label="Instruction editor view" asChild>
					<HStack gap="1" p="0.5" bg="gray.2" borderRadius="l1" flexShrink="0">
						<TabButton value="raw">Raw</TabButton>
						<TabButton value="preview">Preview</TabButton>
					</HStack>
				</Tabs.List>
			</HStack>
			{/* existing instruction controls */}
		</Card.Header>
		<Card.Body minH="0" overflow="hidden">
			<Tabs.Content asChild value="raw">
				<Box h="100%" minH="0">{/* labelled Textarea */}</Box>
			</Tabs.Content>
			<Tabs.Content asChild value="preview">
				<Box bg="gray.2" borderRadius="l2" h="100%" minH="0" overflowY="auto" p="4">
					<MarkdownContent>{selected?.content || '_No instructions yet._'}</MarkdownContent>
				</Box>
			</Tabs.Content>
		</Card.Body>
	</Card.Root>
</Tabs.Root>
```

If plan 023 lands first, preserve its content-driven card/panel sizing; change semantics only and do not restore its removed height locks.

### Replace the custom Select internals with Ark Select

Preserve the repository's public single-value API, add a required persistent `label`, and use Ark's collection/listbox implementation. The semantic subtree is exact; retain the current class visual values on the corresponding trigger/content/item parts:

```tsx
// src/components/ui/select.tsx — target semantic structure
import { Portal } from '@ark-ui/react/portal'
import { Select as ArkSelect, createListCollection } from '@ark-ui/react/select'
import { css } from 'styled-system/css'
import { visuallyHidden } from 'styled-system/patterns'

export type SelectOption = string | { label: string; value: string }

type NormalizedOption = { label: string; value: string }

export function Select({
	disabled = false,
	label,
	loading = false,
	onChange,
	options,
	placeholder,
	value,
	width = '15rem',
}: {
	disabled?: boolean
	label: string
	loading?: boolean
	onChange: (value: string) => void
	options: SelectOption[]
	placeholder?: string
	value: string
	width?: string
}) {
	const collection = createListCollection<NormalizedOption>({
		items: options.map((option) =>
			typeof option === 'string' ? { label: option, value: option } : option,
		),
	})

	return (
		<ArkSelect.Root
			collection={collection}
			disabled={disabled}
			onValueChange={({ value: nextValue }) => {
				const selectedValue = nextValue[0]
				if (selectedValue !== undefined) onChange(selectedValue)
			}}
			positioning={{ placement: 'bottom-end', sameWidth: false }}
			value={value ? [value] : []}
		>
			<Box flexShrink="0" position="relative" w={width}>
				<ArkSelect.Label className={visuallyHidden()}>{label}</ArkSelect.Label>
				<ArkSelect.Control>
					<ArkSelect.Trigger
						aria-busy={loading}
						className={css({ /* exact current trigger styles */ })}
					>
						<ArkSelect.ValueText placeholder={loading ? 'Loading…' : placeholder} />
						<ArkSelect.Indicator aria-hidden="true">▾</ArkSelect.Indicator>
					</ArkSelect.Trigger>
				</ArkSelect.Control>
				<Portal>
					<ArkSelect.Positioner>
						<ArkSelect.Content className={css({ /* exact current popup styles */ })}>
							<ArkSelect.ItemGroup>
								{collection.items.map((option) => (
									<ArkSelect.Item
										className={css({ /* exact current option styles plus selected/highlight styles */ })}
										item={option}
										key={option.value}
									>
										<ArkSelect.ItemText>{option.label}</ArkSelect.ItemText>
										<ArkSelect.ItemIndicator aria-hidden="true">✓</ArkSelect.ItemIndicator>
									</ArkSelect.Item>
								))}
							</ArkSelect.ItemGroup>
						</ArkSelect.Content>
					</ArkSelect.Positioner>
				</Portal>
				<ArkSelect.HiddenSelect />
			</Box>
		</ArkSelect.Root>
	)
}
```

Do not keep the old `open`, outside-click effect, or button-per-option event handlers. Ark must own Enter/Space open/select, Arrow Up/Down, Home/End, Escape, typeahead, selected/highlighted option state, and return focus to the trigger.

Pass specific names at every Select call site:

```tsx
// exact label values
<Select label="Search mode" /* ReviewSearchBar */ />
<Select label="Reviewer instructions" /* ReviewDetailHeader */ />
<Select label="Instruction set" /* ReviewerInstructionsCard */ />
<Select label="Color mode" /* PreferencesCard */ />
<Select label="Code agent" /* PreferencesCard */ />
<Select label="Model" /* PreferencesCard */ />
<Select label="Review language" /* PreferencesCard */ />
```

### Associate every hot-path text field with visible or visually hidden label text

Use native `label`/`htmlFor` plus `id`; do not use `title`, placeholder-only naming, or redundant `aria-label`:

```tsx
// src/features/reviews/components/inbox/ReviewSearchBar.tsx — target
<VisuallyHidden as="label" htmlFor="review-search">Search pull requests</VisuallyHidden>
<Input id="review-search" /* existing controlled/key/placeholder props */ />
```

```tsx
// src/features/reviews/components/GeneratedFindings.tsx — target
<Box as="label" htmlFor="review-decision-body" fontWeight="semibold">Review message</Box>
{/* existing help text */}
<Textarea id="review-decision-body" /* existing controlled props */ />
```

```tsx
// src/features/settings/components/ReviewerInstructionsCard.tsx — target
<VisuallyHidden as="label" htmlFor="instruction-name">Instruction name</VisuallyHidden>
<Input id="instruction-name" /* existing props */ />

<VisuallyHidden as="label" htmlFor="instruction-content">Reviewer instructions markdown</VisuallyHidden>
<Textarea id="instruction-content" /* existing props */ />
```

Make the settings `InlineField` label associable and use it for the export input:

```tsx
// src/features/settings/components/InlineField.tsx — target label fragment
<Box as={htmlFor ? 'label' : 'div'} htmlFor={htmlFor} fontWeight="medium" textStyle="sm">
	{label}
</Box>
```

```tsx
// src/features/settings/components/ReviewExportCard.tsx — target
<InlineField htmlFor="review-export-directory" label="Folder">
	{/* ... */}
	<Input id="review-export-directory" /* existing props */ />
</InlineField>
```

Retain the final target from plan 019 for finding comments. If this plan executes first, implement it now exactly; if plan 019 already did, preserve it:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx — target label association
const commentFieldId = `finding-comment-${finding.id}`

<Box as="label" htmlFor={commentFieldId} color="fg.muted" fontWeight="semibold" textStyle="xs">
	Comment
</Box>
<Textarea id={commentFieldId} /* existing controlled props */ />
```

## Repo conventions to follow

- Reuse `@ark-ui/react`, already used by `src/components/ui/input.tsx:1-6` and `textarea.tsx:1-6`; do not implement ARIA state machines manually.
- Keep the public `Select` value/onChange/options behavior single-valued and preserve all call-site casts and state ownership.
- Preserve the existing `TabButton` styling entry point and Panda visual tokens while changing its semantic base.
- Keep Code, Summary, Review, Raw, and Preview panels mounted when inactive so tab changes do not reset current local state.
- Use canonical associated labels for text controls. `aria-label` remains appropriate only for the already-labelled icon-only search/settings buttons and is not the fix for these visible fields.

## Steps

1. At `src/components/common.tsx:1-57`, rebuild `TabButton` on `Tabs.Trigger`, replace boolean visual branching with `[data-selected]`, and change its contract from `active/onClick` to `value`.
2. At `ReviewDetail.tsx:119-247`, add controlled `Tabs.Root`, labelled `Tabs.List`, and three `Tabs.Content` panels. Preserve `activeTab`, generation-driven activation, action visibility, panel contents, and mounted state.
3. At `ReviewerInstructionsCard.tsx:54-133`, add the controlled Raw/Preview Ark tab relationship. Preserve parent-owned `mode`, New forcing Raw, edited values, and whichever sizing target exists after plan 023.
4. At `src/components/ui/select.tsx:1-131`, replace the custom disclosure/buttons with the exact Ark Select collection structure, retain visual styling, add required `label`, and remove the manual open/outside-click logic.
5. Add the seven exact Select labels at `ReviewSearchBar.tsx:42`, `ReviewDetailHeader.tsx:60`, `ReviewerInstructionsCard.tsx:78`, and `PreferencesCard.tsx:33-73`.
6. Add native label/id associations at `ReviewSearchBar.tsx:48-59`, `GeneratedFindings.tsx:123-142`, `ReviewerInstructionsCard.tsx:87-119`, `InlineField.tsx:4-33`, `ReviewExportCard.tsx:29-37`, and `EditableFindingCard.tsx:22-93`, preserving plan 019's final finding editor if present.
7. Re-read the diff and remove obsolete tab `display` conditions, Select state/effect/ref code, placeholder-only naming, and unrelated styling churn.

## Boundaries

- Do NOT hand-roll tab roving focus, listbox active-descendant logic, typeahead, outside-click handling, or Escape behavior; Ark owns these semantics.
- Do NOT add a dependency, convert Select to a native `<select>`, or change its single-value API beyond requiring `label`.
- Do NOT unmount inactive panels, reset selected files/instructions/review state, or change the initial Summary/Raw/Preview decisions.
- Do NOT use `title` as the sole accessible name, remove visible labels, or add redundant `aria-label` where a native associated label is available.
- Do NOT change search execution, generation settings, instruction persistence, export paths, or review publishing payloads.
- Do NOT add React Testing Library, jsdom, Playwright, component tests, browser tests, or dependencies. These interactions require runtime keyboard/AT verification; add Node Vitest only if a new pure helper is introduced, and do not extract one solely to manufacture a test.
- STOP if the cited controls have drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` clears any changed-code `react-doctor/control-has-associated-label` diagnostic and does not regress the stamped score of 81.
  - Run an unfiltered React Doctor scan of `src/components/ui/select.tsx` and all changed call sites; do not claim the rule is clear from changed-scope output alone.
- **Tabs check**: Focus Summary and use Right/Left/Home/End. Confirm one tab stop, focus and selection move together, the selected tab reports `aria-selected="true"`, and each tab controls exactly one named tabpanel. Repeat for Raw/Preview and verify edited text survives switching.
- **Select check**: For each shared Select, verify its accessible name from the exact label list. Use Enter/Space, Arrow Up/Down, Home/End, typeahead, Escape, and Enter selection; confirm selected/highlighted state is announced, closure returns focus to the trigger, and disabled/loading controls remain unavailable.
- **Field check**: Inspect the accessibility tree for inbox search, review message, finding comment, instruction name/content, and export folder. Confirm each exposes its associated label after the field contains text (when its placeholder has disappeared), with unchanged role/value/help copy.
- **Done when**: both tab sets follow the ARIA tab keyboard model, every Select follows listbox/combobox semantics through Ark, every hot-path field has a persistent associated name using the canonical recipe, state is preserved across panels, and repository checks pass without DOM/browser test dependencies.
