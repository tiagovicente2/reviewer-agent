import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'
import { Box, HStack } from 'styled-system/jsx'
import type { ReviewInlineComment } from '@/shared/review'
import { type DiffDisplaySettings, getDiffOptions } from './diffDisplayUtils'
import type { DiffAnnotation } from './diffViewerUtils'
import { getLineAnnotations, groupInlineCommentsByPath } from './diffViewerUtils'
import { ReviewCommentAnnotation } from './ReviewCommentAnnotation'

export function DiffFileView({
	disableFileHeader = false,
	fileDiff,
	inlineComments,
	settings,
}: {
	disableFileHeader?: boolean
	fileDiff: FileDiffMetadata
	inlineComments: ReviewInlineComment[]
	settings: DiffDisplaySettings
}) {
	const commentsByPath = groupInlineCommentsByPath(inlineComments)
	const annotations = getLineAnnotations(fileDiff, commentsByPath)
	const additions = fileDiff.hunks.reduce((total, hunk) => total + hunk.additionLines, 0)
	const deletions = fileDiff.hunks.reduce((total, hunk) => total + hunk.deletionLines, 0)

	return (
		<Box maxW="100%" minW="0" overflow="hidden">
			<FileDiff<DiffAnnotation>
				disableWorkerPool
				fileDiff={fileDiff}
				lineAnnotations={annotations}
				options={getDiffOptions(settings, { disableFileHeader })}
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
