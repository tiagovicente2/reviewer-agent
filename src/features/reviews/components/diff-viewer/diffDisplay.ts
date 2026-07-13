import type { FileDiffOptions } from '@pierre/diffs'
import { parsePatchFiles } from '@pierre/diffs/direct/utils/parsePatchFiles.js'
import type { DiffAnnotation } from './diffViewerUtils'

export type DiffDisplaySettings = {
	diffIndicators: 'bars' | 'classic' | 'none'
	diffStyle: 'split' | 'unified'
	disableBackground: boolean
	disableLineNumbers: boolean
	hunkSeparators: 'line-info' | 'line-info-basic' | 'metadata' | 'simple'
	lineDiffType: 'word-alt' | 'word' | 'char' | 'none'
	overflow: 'scroll' | 'wrap'
}

const baseDiffDisplaySettings = {
	diffIndicators: 'bars',
	disableBackground: false,
	disableLineNumbers: false,
	hunkSeparators: 'line-info',
	lineDiffType: 'word-alt',
	overflow: 'wrap',
} satisfies Omit<DiffDisplaySettings, 'diffStyle'>

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

export function getDiffOptions(
	settings: DiffDisplaySettings,
	overrides: Pick<FileDiffOptions<DiffAnnotation>, 'disableFileHeader'> = {},
): FileDiffOptions<DiffAnnotation> {
	return {
		collapsedContextThreshold: 8,
		diffIndicators: settings.diffIndicators,
		diffStyle: settings.diffStyle,
		disableBackground: settings.disableBackground,
		disableLineNumbers: settings.disableLineNumbers,
		hunkSeparators: settings.hunkSeparators,
		lineDiffType: settings.lineDiffType,
		overflow: settings.overflow,
		theme: { dark: 'pierre-dark', light: 'pierre-light' },
		themeType: 'dark',
		...overrides,
	}
}
