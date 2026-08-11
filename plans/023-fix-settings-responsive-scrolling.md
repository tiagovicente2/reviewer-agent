# 023 — Fix settings responsive scrolling

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 3 files, medium layout-only change

## Problem

The settings page combines a viewport-height shell with a second `h="100%"` content grid below a header. The grid is clipped by `overflow="hidden"`, and its left column is a separate vertical scroller:

```tsx
// src/features/settings/components/SettingsPage.tsx:133-189 — current
<Box boxSizing="border-box" h="100%" overflow="hidden" px="8" py="6">
	<Stack gap="4" h="100%" minH="0" mx="auto" w="100%">
		<HStack alignItems="flex-start" justify="space-between">
			<Box>
				<Box as="h1" fontWeight="bold" textStyle="3xl">
					Settings
				</Box>
				<Box color="fg.muted" textStyle="sm">
					Configure local review generation.
				</Box>
			</Box>
			<HStack gap="2" flexShrink="0">
				{/* settings actions */}
			</HStack>
		</HStack>

		{error ? <StatusCard tone="red" title="Could not save settings" body={error} /> : null}
		{settings ? (
			<Box
				display="grid"
				gap="4"
				gridTemplateColumns={{
					base: 'minmax(0, 1fr)',
					xl: '32rem minmax(0, 1fr)',
				}}
				h="100%"
				minH="0"
				overflow="hidden"
			>
				<Stack gap="4" h="100%" minH="0" overflowY="auto">
```

Below `xl`, that grid becomes one column but both children retain viewport-filling constraints. The instructions card is itself a fixed-height grid with hidden overflow, and its preview adds another vertical scroller:

```tsx
// src/features/settings/components/ReviewerInstructionsCard.tsx:54-60,107-130 — current
<Card.Root
	h="100%"
	minH="0"
	overflow="hidden"
	display="grid"
	gridTemplateRows="auto minmax(0, 1fr)"
>
	{/* header */}
	<Card.Body minH="0" overflow="hidden">
		<Box display={mode === 'raw' ? 'block' : 'none'} h="100%" minH="0">
			<Textarea
				boxSizing="border-box"
				display="block"
				h="100%"
				minH="0"
				resize="none"
				placeholder="Custom markdown instructions for the reviewer agent."
				value={selected?.content ?? ''}
				onChange={(event) => updateSelected({ content: event.target.value })}
				variant="surface"
			/>
		</Box>
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
	</Card.Body>
</Card.Root>
```

`AgentStatusCard` contributes a third constrained region:

```tsx
// src/features/settings/components/AgentStatusCard.tsx:16-38 — current
<Card.Root flex="1" minH="0" overflow="hidden" variant="outline">
	{/* header */}
	<Card.Body minH="0" overflowY="auto">
```

At an approximately 1100 px-wide Electron window, and sooner when page zoom increases, users can encounter clipped lower cards, a hidden instructions card, or wheel/keyboard scrolling trapped in whichever nested region currently has focus.

## Target

Make the settings page itself the single vertical scroller. Let the header wrap, remove viewport-height constraints from the content grid, and let cards establish their own natural height below `xl`:

```tsx
// src/features/settings/components/SettingsPage.tsx — target shape
<Box boxSizing="border-box" h="100%" minH="0" overflowY="auto" px="8" py="6">
	<Stack gap="4" minH="100%" mx="auto" w="100%">
		<HStack
			alignItems={{ base: 'stretch', md: 'flex-start' }}
			flexDirection={{ base: 'column', md: 'row' }}
			justify="space-between"
		>
			<Box>
				<Box as="h1" fontWeight="bold" textStyle="3xl">
					Settings
				</Box>
				<Box color="fg.muted" textStyle="sm">
					Configure local review generation.
				</Box>
			</Box>
			<HStack flexShrink="0" flexWrap="wrap" gap="2">
				<IconButton ariaLabel="Local cache" onClick={() => setIsCacheModalOpen(true)}>
					<CacheIcon />
				</IconButton>
				<Box position="relative">
					<IconButton ariaLabel="Check for updates" onClick={() => setIsUpdateModalOpen(true)}>
						<UpdateIcon />
					</IconButton>
					{updateStatus?.available && (
						<Box
							bg="cyan.9"
							borderRadius="full"
							h="2.5"
							position="absolute"
							right="1"
							top="1"
							w="2.5"
						/>
					)}
				</Box>
				<Button variant="outline" onClick={onOpenErrorLog}>
					Error log
				</Button>
				<Button variant="outline" onClick={onBack}>
					Back
				</Button>
				<Button loading={state === 'loading'} onClick={save} disabled={!settings}>
					Save
				</Button>
			</HStack>
		</HStack>

		{error ? <StatusCard tone="red" title="Could not save settings" body={error} /> : null}
		{settings ? (
			<Box
				alignItems="start"
				display="grid"
				gap="4"
				gridTemplateColumns={{
					base: 'minmax(0, 1fr)',
					xl: '32rem minmax(0, 1fr)',
				}}
			>
				<Stack gap="4" minW="0">
					<PreferencesCard
						availableModels={availableModels}
						onChange={setSettings}
						selectedAgentAvailability={selectedAgentAvailability}
						settings={settings}
					/>
					<AgentStatusCard
						agents={agentAvailability}
						agentsState={agentsState}
						onRefresh={() => void refreshAgentAvailability()}
					/>
					<ReviewExportCard onChange={setSettings} settings={settings} />
				</Stack>
				<ReviewerInstructionsCard
					instructions={settings.reviewerInstructions}
					mode={instructionsMode}
					onChangeInstructions={(reviewerInstructions) =>
						setSettings({ ...settings, reviewerInstructions })
					}
					onChangeMode={setInstructionsMode}
					path={settings.reviewerInstructionsPath}
				/>
			</Box>
		) : null}
	</Stack>
</Box>
```

The card target is content-driven and contains no vertical scroller. The unchanged header remains between these exact edited fragments:

```tsx
// src/features/settings/components/ReviewerInstructionsCard.tsx:55 — target opening tag
<Card.Root minH="0" minW="0" overflow="visible">
```

```tsx
// src/features/settings/components/ReviewerInstructionsCard.tsx:107-132 — target body subtree
<Card.Body minH="0" overflow="visible">
		<Box display={mode === 'raw' ? 'block' : 'none'} minH="0">
			<Textarea
				boxSizing="border-box"
				display="block"
				minH="24rem"
				resize="vertical"
				placeholder="Custom markdown instructions for the reviewer agent."
				value={selected?.content ?? ''}
				onChange={(event) => updateSelected({ content: event.target.value })}
				variant="surface"
			/>
		</Box>
		<Box
			bg="gray.2"
			borderRadius="l2"
			display={mode === 'preview' ? 'block' : 'none'}
			minH="24rem"
			p="4"
		>
			<MarkdownContent>{selected?.content || '_No instructions yet._'}</MarkdownContent>
		</Box>
	</Card.Body>
```

Make system status content-driven too by replacing its two constrained opening tags exactly:

```tsx
// src/features/settings/components/AgentStatusCard.tsx:16 — target
<Card.Root minH="0" overflow="visible" variant="outline">
```

```tsx
// src/features/settings/components/AgentStatusCard.tsx:38 — target
<Card.Body minH="0" overflow="visible">
```

Long markdown tables and code blocks keep their own horizontal scrolling from `MarkdownContent`; this plan removes only nested **vertical** scroll regions.

## Repo conventions to follow

- Keep layout in Panda style props; do not add a global CSS exception.
- Imitate the page-level scrolling pattern in `src/features/errors/components/ErrorLogPage.tsx:24-43`, but use one page scroller rather than its constrained list scroller.
- Preserve the current `base`/`xl` two-column breakpoint and `minmax(0, 1fr)` column convention.
- Preserve component ownership and every settings callback.

## Steps

1. At `src/features/settings/components/SettingsPage.tsx:133-189`, move vertical overflow ownership to the outer page, make the header/actions wrap, and remove `h="100%"`, `overflow="hidden"`, and left-column `overflowY="auto"` from the content region.
2. At `src/features/settings/components/ReviewerInstructionsCard.tsx:54-60`, remove the fixed-height internal grid and hidden overflow; retain natural card layout through the existing `Card` recipe.
3. At `src/features/settings/components/ReviewerInstructionsCard.tsx:107-130`, remove the raw/preview height locks and preview vertical scroller, and give both modes a usable `24rem` content minimum. Keep horizontal overflow behavior inside markdown tables and code unchanged.
4. At `src/features/settings/components/AgentStatusCard.tsx:16-38`, remove flex filling and body vertical scrolling so every status row contributes to page height.
5. Re-read the diff at viewport widths above and below `xl`; remove only obsolete sizing/overflow props and unrelated formatting churn.

## Boundaries

- Do NOT change settings state, RPC calls, field behavior, modal behavior, or save/navigation behavior.
- Do NOT add a second page or card-level vertical scroller; the outer settings page must be the coherent vertical scroll owner.
- Do NOT remove horizontal scrolling from markdown `pre` or `table` elements.
- Do NOT change the `xl` column widths or collapse the desktop layout to one column.
- Do NOT add component/browser test dependencies. STOP if these files have drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostics and no score regression.
- **Behavior check**: Open Settings in an 1100×700 window at 100% zoom, then at 200% zoom. In Raw and Preview modes, use wheel, Page Down, Shift+Tab, and keyboard focus traversal. Confirm one vertical page scrollbar reaches Preferences, all System status rows, Review export, the full instructions card, and its controls without clipped card borders or a trapped nested scroll region.
- **Desktop check**: At or above `xl`, confirm the two columns remain aligned and all actions, selects, textarea content, preview tables, and preview code blocks remain usable.
- **Done when**: settings has one coherent vertical scroll path, below-`xl` heights are content-driven, and no card is clipped at 1100 px or zoomed layouts.
