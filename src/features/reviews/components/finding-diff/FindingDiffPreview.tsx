import { Box } from 'styled-system/jsx'
import type { ReviewFinding, ReviewInlineComment } from '@/shared/review'
import { DiffFileView } from '../diff-viewer/DiffDisplay'
import { findPatchFile, reviewDiffDisplaySettings } from '../diff-viewer/diffDisplayUtils'
import { getFocusedFileDiff } from './findingDiffPreviewUtils'

export function FindingDiffPreview({
	diff,
	finding,
	inlineComments,
}: {
	diff: string
	finding: ReviewFinding
	inlineComments: ReviewInlineComment[]
}) {
	const fileDiff = findPatchFile(diff, finding.filePath)
	const focusedFileDiff =
		fileDiff && finding.lineStart ? getFocusedFileDiff(fileDiff, finding.lineStart) : null
	if (!focusedFileDiff) {
		return finding.codeSnippet ? <CodeSnippetBlock code={finding.codeSnippet} /> : null
	}

	return (
		<DiffFileView
			fileDiff={focusedFileDiff}
			inlineComments={inlineComments}
			settings={reviewDiffDisplaySettings}
		/>
	)
}

function CodeSnippetBlock({ code }: { code: string }) {
	return (
		<Box
			as="pre"
			bg="gray.1"
			borderColor="border.default"
			borderRadius="l2"
			borderWidth="1px"
			color="fg.default"
			fontFamily="mono"
			fontSize="xs"
			lineHeight="1.7"
			maxW="100%"
			overflowX="auto"
			p="3"
			whiteSpace="pre"
		>
			{code}
		</Box>
	)
}
