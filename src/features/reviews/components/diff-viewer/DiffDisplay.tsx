import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'
import { Box, HStack } from 'styled-system/jsx'
import { useColorMode } from '@/app/hooks/useColorMode'
import type { ReviewInlineComment } from '@/shared/review'
import { type DiffDisplaySettings, getDiffOptions } from './diffDisplayUtils'
import type { DiffAnnotation } from './diffViewerUtils'
import { getLineAnnotations, groupInlineCommentsByPath } from './diffViewerUtils'
import { ReviewCommentAnnotation } from './ReviewCommentAnnotation'

export function DiffFileView({
	colorMode: propColorMode,
	disableFileHeader = false,
	fileDiff,
	inlineComments = [],
	selectedLines,
	settings,
}: {
	colorMode?: 'dark' | 'light'
	disableFileHeader?: boolean
	fileDiff: FileDiffMetadata
	inlineComments?: ReviewInlineComment[]
	selectedLines?: { start: number; end: number } | null
	settings: DiffDisplaySettings
}) {
	const { colorMode: hookColorMode } = useColorMode()
	const effectiveColorMode = propColorMode ?? hookColorMode
	const commentsByPath = groupInlineCommentsByPath(inlineComments)
	const annotations = getLineAnnotations(fileDiff, commentsByPath)
	const additions = fileDiff.hunks.reduce((total, hunk) => total + hunk.additionLines, 0)
	const deletions = fileDiff.hunks.reduce((total, hunk) => total + hunk.deletionLines, 0)

	return (
		<Box maxW="100%" minW="0" overflow="hidden">
			<FileDiff<DiffAnnotation>
				key={effectiveColorMode}
				disableWorkerPool
				fileDiff={fileDiff}
				lineAnnotations={annotations}
				selectedLines={selectedLines}
				options={getDiffOptions(settings, { disableFileHeader }, effectiveColorMode)}
				renderAnnotation={(annotation: DiffLineAnnotation<DiffAnnotation>) => (
					<ReviewCommentAnnotation {...annotation} />
				)}
				renderHeaderMetadata={() => (
					<HStack gap="2" fontFamily="mono" fontSize="xs">
						<Box color="red.11">-{deletions}</Box>
						<Box color="green.11">+{additions}</Box>
					</HStack>
				)}
			/>
		</Box>
	)
}
