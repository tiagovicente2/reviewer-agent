import { Box } from 'styled-system/jsx'
import type { ReviewFinding, ReviewInlineComment } from '@/shared/review'
import { DiffFileView } from '../diff-viewer/DiffDisplay'
import {
	codeDiffDisplaySettings,
	findPatchFile,
	reviewDiffDisplaySettings,
} from '../diff-viewer/diffDisplayUtils'
import { buildSuggestionFileDiff, getFocusedFileDiff } from './findingDiffPreviewUtils'

export function FindingDiffPreview({
	diff,
	finding,
	inlineComments,
}: {
	diff: string
	finding: ReviewFinding
	inlineComments?: ReviewInlineComment[]
}) {
	const fileDiff = findPatchFile(diff, finding.filePath)
	const hasFixSuggestion = Boolean(finding.fixSuggestion?.trim())

	if (hasFixSuggestion) {
		const suggestionFileDiff = buildSuggestionFileDiff(fileDiff, finding)
		if (suggestionFileDiff) {
			return <DiffFileView fileDiff={suggestionFileDiff} settings={reviewDiffDisplaySettings} />
		}
	}

	const focusedFileDiff =
		fileDiff && finding.lineStart
			? getFocusedFileDiff(fileDiff, finding.lineStart, finding.lineEnd)
			: null
	if (!focusedFileDiff) {
		return finding.codeSnippet ? <CodeSnippetBlock code={finding.codeSnippet} /> : null
	}

	const selectedLines = finding.lineStart
		? {
				start: finding.lineStart,
				end:
					typeof finding.lineEnd === 'number' && finding.lineEnd >= finding.lineStart
						? finding.lineEnd
						: finding.lineStart,
			}
		: null

	return (
		<DiffFileView
			fileDiff={focusedFileDiff}
			inlineComments={inlineComments}
			selectedLines={selectedLines}
			settings={codeDiffDisplaySettings}
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
			h="100%"
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
