# 024 — Guard unsaved settings changes

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 3 files, medium state change plus pure-helper tests

## Problem

`SettingsPage` keeps only one mutable settings object. It does not retain the last successfully loaded/saved value, so it cannot distinguish persisted settings from an edited draft:

```tsx
// src/features/settings/components/SettingsPage.tsx:28-36 — current
const [settings, setSettings] = useState<AppSettings | null>(null)
const [state, setState] = useState<AsyncState>('loading')
const [error, setError] = useState('')
const [availableModels, setAvailableModels] = useState<AvailablePiModel[]>([])
const [agentAvailability, setAgentAvailability] = useState<AgentAvailability[]>([])
const [agentsState, setAgentsState] = useState<AsyncState>('idle')
const [instructionsMode, setInstructionsMode] = useState<'raw' | 'preview'>('raw')
const instructionsModeInitializedRef = useRef(false)
const { showToast } = useToast()
```

Loading and saving both replace that same object, with no baseline for dirty-state comparison:

```tsx
// src/features/settings/components/SettingsPage.tsx:41-50,116-129 — current
appRpc.request
	.getAppSettings()
	.then((value) => {
		if (cancelled) return
		setSettings(value)
		if (!instructionsModeInitializedRef.current) {
			setInstructionsMode(value.reviewerInstructions[0]?.content.trim() ? 'preview' : 'raw')
			instructionsModeInitializedRef.current = true
		}
		setState('idle')
	})

const save = async () => {
	if (!settings) return
	setState('loading')
	setError('')
	try {
		const saved = await appRpc.request.saveAppSettings(settings)
		setSettings(saved)
		onSaved(saved)
		setState('idle')
		showToast({ title: 'Settings saved', tone: 'success' })
	} catch (unknownError) {
		setError(getErrorMessage(unknownError))
		setState('error')
	}
}
```

Both navigation controls immediately unmount the page and silently discard edits:

```tsx
// src/features/settings/components/SettingsPage.tsx:164-172 — current
<Button variant="outline" onClick={onOpenErrorLog}>
	Error log
</Button>
<Button variant="outline" onClick={onBack}>
	Back
</Button>
<Button loading={state === 'loading'} onClick={save} disabled={!settings}>
	Save
</Button>
```

This is especially risky for long reviewer instructions: changing a name/content, adding or deleting an instruction, or changing preferences can be lost with no visible warning. A failed save must remain dirty, while a successful save must become the new preserved baseline.

## Target

Add a pure comparison helper that compares only editable/persisted fields. Do not include derived `reviewerInstructionsPath` or non-editable `onboardingComplete` in dirty state:

```ts
// src/features/settings/settingsDirtyState.ts — target
import type { AppSettings, ReviewerInstruction } from '@/shared/settings'

function instructionsEqual(left: ReviewerInstruction[], right: ReviewerInstruction[]) {
	return (
		left.length === right.length &&
		left.every((instruction, index) => {
			const other = right[index]
			return (
				other !== undefined &&
				instruction.id === other.id &&
				instruction.name === other.name &&
				instruction.content === other.content
			)
		})
	)
}

export function hasUnsavedSettings(
	current: AppSettings | null,
	persisted: AppSettings | null,
) {
	if (!current || !persisted) return false

	return (
		current.colorMode !== persisted.colorMode ||
		current.codeAgent !== persisted.codeAgent ||
		current.model !== persisted.model ||
		current.reviewLanguage !== persisted.reviewLanguage ||
		current.reviewExportDirectory !== persisted.reviewExportDirectory ||
		!instructionsEqual(current.reviewerInstructions, persisted.reviewerInstructions)
	)
}
```

Retain the persisted baseline separately, update it only after load/save success, and route both exit controls through one guard:

```tsx
// src/features/settings/components/SettingsPage.tsx — target state and handlers
import { hasUnsavedSettings } from '../settingsDirtyState'

const [settings, setSettings] = useState<AppSettings | null>(null)
const [persistedSettings, setPersistedSettings] = useState<AppSettings | null>(null)
// preserve the remaining existing state

const isDirty = hasUnsavedSettings(settings, persistedSettings)

const requestLeave = (leave: () => void) => {
	if (state === 'loading') return
	if (
		isDirty &&
		!window.confirm('Discard unsaved settings changes? Your last saved settings will be kept.')
	) {
		return
	}
	leave()
}
```

Use the baseline in both successful paths and never in failure paths:

```tsx
// src/features/settings/components/SettingsPage.tsx — target load/save updates
appRpc.request
	.getAppSettings()
	.then((value) => {
		if (cancelled) return
		setSettings(value)
		setPersistedSettings(value)
		if (!instructionsModeInitializedRef.current) {
			setInstructionsMode(value.reviewerInstructions[0]?.content.trim() ? 'preview' : 'raw')
			instructionsModeInitializedRef.current = true
		}
		setState('idle')
	})

const save = async () => {
	if (!settings || !isDirty) return
	setState('loading')
	setError('')
	try {
		const saved = await appRpc.request.saveAppSettings(settings)
		setSettings(saved)
		setPersistedSettings(saved)
		onSaved(saved)
		setState('idle')
		showToast({ title: 'Settings saved', tone: 'success' })
	} catch (unknownError) {
		setError(getErrorMessage(unknownError))
		setState('error')
	}
}
```

Show persistent, visible state next to the existing settings description and guard both exits:

```tsx
// src/features/settings/components/SettingsPage.tsx — target header/actions
<Box>
	<Box as="h1" fontWeight="bold" textStyle="3xl">
		Settings
	</Box>
	<Box color="fg.muted" textStyle="sm">
		Configure local review generation.
	</Box>
	{settings ? (
		<Box
			aria-live="polite"
			color={isDirty ? 'cyan.11' : 'fg.muted'}
			fontWeight={isDirty ? 'semibold' : 'normal'}
			mt="1"
			role="status"
			textStyle="xs"
		>
			{isDirty ? 'Unsaved changes' : 'All changes saved'}
		</Box>
	) : null}
</Box>

<Button
	disabled={state === 'loading'}
	variant="outline"
	onClick={() => requestLeave(onOpenErrorLog)}
>
	Error log
</Button>
<Button disabled={state === 'loading'} variant="outline" onClick={() => requestLeave(onBack)}>
	Back
</Button>
<Button loading={state === 'loading'} onClick={save} disabled={!settings || !isDirty}>
	Save
</Button>
```

Add pure Node Vitest coverage:

```ts
// src/features/settings/settingsDirtyState.test.ts — target cases
import { describe, expect, it } from 'vitest'
import type { AppSettings } from '@/shared/settings'
import { hasUnsavedSettings } from './settingsDirtyState'

const persisted: AppSettings = {
	colorMode: 'system',
	codeAgent: 'pi',
	model: 'openai/gpt-5',
	reviewLanguage: 'english',
	reviewExportDirectory: '/tmp/reviews',
	reviewerInstructions: [{ id: 'default', name: 'Default', content: '# Review' }],
	reviewerInstructionsPath: '/tmp/instructions.json',
	onboardingComplete: true,
}

describe('hasUnsavedSettings', () => {
	it('detects editable scalar and instruction changes', () => {
		expect(hasUnsavedSettings({ ...persisted, reviewLanguage: 'portuguese' }, persisted)).toBe(true)
		expect(
			hasUnsavedSettings(
				{
					...persisted,
					reviewerInstructions: [{ ...persisted.reviewerInstructions[0]!, content: '# Changed' }],
				},
				persisted,
			),
		).toBe(true)
	})

	it('ignores derived and non-editable fields', () => {
		expect(
			hasUnsavedSettings(
				{ ...persisted, onboardingComplete: false, reviewerInstructionsPath: '/other/path' },
				persisted,
			),
		).toBe(false)
	})
})
```

## Repo conventions to follow

- Keep RPC and draft ownership in `SettingsPage`; the helper only compares values.
- Follow pure-helper Vitest style in `src/features/reviews/components/review-tabs/summary/reviewerStatus.test.ts:1-20`.
- Preserve controlled updates through `setSettings` and the existing child `onChange` callbacks.
- Use the existing native Electron/Chromium `window.confirm`; do not introduce a dialog dependency for this guard.

## Steps

1. Create `src/features/settings/settingsDirtyState.ts` with the exact editable-field comparison above; compare instruction order, IDs, names, and content.
2. At `src/features/settings/components/SettingsPage.tsx:28`, add `persistedSettings`, derive `isDirty`, and set both current and persisted values after the initial load.
3. At `src/features/settings/components/SettingsPage.tsx:116-129`, return early when clean, update the baseline only after `saveAppSettings` succeeds, and preserve the dirty draft and old baseline on failure.
4. At `src/features/settings/components/SettingsPage.tsx:136-172`, render the saved/unsaved indication, disable Save while clean, and route Back and Error log through `requestLeave`.
5. Add `src/features/settings/settingsDirtyState.test.ts` as a pure Node Vitest test; do not render `SettingsPage` or install DOM/browser test tooling.

## Boundaries

- Do NOT autosave, persist drafts separately, reset fields after a failed save, or mutate the loaded baseline in place.
- Do NOT mark `reviewerInstructionsPath` or `onboardingComplete` dirty; users cannot edit them on this page.
- Do NOT guard cache/update modal opening; guard only navigation that leaves Settings: Back and Error log.
- Do NOT add React Testing Library, jsdom, Playwright, or any component/browser dependency. Vitest is allowed only for the pure helper.
- Do NOT combine this with plan 023 layout edits. STOP if `SettingsPage.tsx` has drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm test -- src/features/settings/settingsDirtyState.test.ts`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostics and no score regression.
- **Behavior check**: Change each preference and reviewer instruction field in turn. Confirm “Unsaved changes” appears and Save enables. Cancel Back and Error log confirmations and confirm every edit remains. Accept either confirmation and reopen Settings; confirm the last successfully saved values, not the abandoned draft, are loaded.
- **Save-state check**: Save edits successfully and confirm “All changes saved,” disabled Save, and no prompt on Back/Error log. Force a save failure and confirm the dirty indication and draft remain, while reopening after discard restores the previous persisted values.
- **Done when**: all editable settings have accurate dirty state, unsaved exits require confirmation, and only successful saves replace the preserved baseline.
