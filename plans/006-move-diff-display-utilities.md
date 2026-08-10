# 006 — Move DiffDisplay utilities out of component file

- **Status**: TODO
- **Commit**: 44835be
- **Severity**: LOW
- **Category**: Maintainability & architecture
- **Rule**: react-doctor/only-export-components
- **Estimated scope**: 2 files, small refactor

## Problem

`src/features/reviews/components/diff-viewer/DiffDisplay.tsx` exports React components and non-component utilities/constants in the same `.tsx` file:

```tsx
// src/features/reviews/components/diff-viewer/DiffDisplay.tsx:29 — current
export const codeDiffDisplaySettings: DiffDisplaySettings = {
	...baseDiffDisplaySettings,
	diffStyle: 'unified',
}

export const reviewDiffDisplaySettings: DiffDisplaySettings = {
	...baseDiffDisplaySettings,
	diffStyle: 'split',
}

export function parsePatch(patch: string) {
	try {
		return {
			error: undefined,
			files: parsePatchFiles(patch, 'github-pr-diff', true).flatMap(
				(parsedPatch) => parsedPatch.files,
			),
		}
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
			files: [],
		}
	}
}

export function findPatchFile(patch: string, filePath: string) {
	return (
		parsePatch(patch).files.find((file) => file.name === filePath || file.prevName === filePath) ??
		null
	)
}
```

This weakens Vite/Fast Refresh boundaries and mixes diff utility ownership with component rendering.

## Target

Canonical recipe from `react-doctor/only-export-components`:

> Split the module so the component file exports only components (and constants/hooks if your toolchain allows them): move utility functions, enums, objects, and `createContext(...)` calls into a sibling non-component file and re-import them (`import { ChatContext } from './context'`). Name anonymous defaults (`export default function Foo() {}` instead of `export default () => {}`), and replace `export *` with explicit named exports.

Target shape:

```ts
// src/features/reviews/components/diff-viewer/diffDisplayUtils.ts
export type DiffDisplaySettings = { ... }
export const codeDiffDisplaySettings: DiffDisplaySettings = { ... }
export const reviewDiffDisplaySettings: DiffDisplaySettings = { ... }
export function parsePatch(patch: string) { ... }
export function findPatchFile(patch: string, filePath: string) { ... }
```

```tsx
// src/features/reviews/components/diff-viewer/DiffDisplay.tsx
import type { DiffDisplaySettings } from './diffDisplayUtils'
import { getDiffOptions } from './diffDisplayUtils' // only if moved
export function DiffFileView(...) { ... }
```

## Repo conventions to follow

- Existing sibling utility file: `src/features/reviews/components/diff-viewer/diffViewerUtils.ts`.
- Prefer a new `diffDisplayUtils.ts` if moving these exports into `diffViewerUtils.ts` would make that file too broad.
- Update imports in `ReviewDetail.tsx`, `ReviewDetailTabs.tsx`, `DiffViewer.tsx`, and `EditableFindingCard.tsx` if they currently import utilities from `DiffDisplay.tsx`.

## Steps

1. Create `src/features/reviews/components/diff-viewer/diffDisplayUtils.ts`.
2. Move `DiffDisplaySettings`, `baseDiffDisplaySettings`, `codeDiffDisplaySettings`, `reviewDiffDisplaySettings`, `parsePatch`, and `findPatchFile` into it.
3. Leave `DiffFileView` in `DiffDisplay.tsx`; import the moved type/helper values back from `diffDisplayUtils.ts`.
4. Update all callers to import utility values from `diffDisplayUtils.ts` and components from `DiffDisplay.tsx`.
5. Ensure `DiffDisplay.tsx` exports only React components.

## Boundaries

- Do NOT change diff parsing behavior or display settings values.
- Do NOT rename public component exports unless all imports are updated mechanically.
- STOP if `DiffDisplay.tsx` has drifted from commit `44835be`.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears `react-doctor/only-export-components` for `DiffDisplay.tsx` and the score does not regress.
  - `pnpm run typecheck`
  - `pnpm run lint`
- **Behavior check**: Open a PR, render Summary/Code/Review tabs, expand a diff file, and confirm line annotations/comments still render.
- **Done when**: utility exports are no longer in `DiffDisplay.tsx`, imports compile, and diff behavior is unchanged.
