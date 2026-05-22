import type { FileDiffMetadata } from '@pierre/diffs'
import { useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Badge, Button, Textarea } from '@/components/ui'
import type { PiInlineComment, PiReviewFinding } from '@/shared/review'
import {
	DiffFileView,
	findPatchFile,
	parsePatch,
	reviewDiffDisplaySettings,
} from './diff-viewer/DiffDisplay'
import { severityColorPalette } from './reviewUtils'

export function EditableFindingCard({
	diff,
	finding,
	inlineComments,
	onPublishFinding,
	publishing,
}: {
	diff: string
	finding: PiReviewFinding
	inlineComments: PiInlineComment[]
	onPublishFinding?: (finding: PiReviewFinding) => void
	publishing: boolean
}) {
	const [commentBody, setCommentBody] = useState(finding.suggestedCommentBody || finding.body)
	const canPublish = Boolean(finding.filePath && finding.lineStart && commentBody.trim())
	const publishableFinding = {
		...finding,
		suggestedCommentBody: commentBody.trim(),
	}
	const referencedInlineComments = inlineComments.filter((comment) => {
		const findingBody = (finding.suggestedCommentBody || finding.body).trim()
		return (
			comment.path === finding.filePath &&
			comment.side === 'RIGHT' &&
			comment.line === finding.lineStart &&
			comment.body.trim() === findingBody
		)
	})

	return (
		<Box borderTopWidth="1px" maxW="100%" overflow="visible" py="5">
			<Stack gap="4" minW="0" overflow="visible">
				<Stack gap="3">
					<HStack justify="space-between" gap="3" alignItems="flex-start">
						<Stack gap="2" minW="0">
							<Badge
								alignSelf="flex-start"
								colorPalette={severityColorPalette(finding.severity)}
							>
								{finding.severity}
							</Badge>
							<Box fontWeight="semibold">{finding.title}</Box>
						</Stack>
						<Button
							disabled={!canPublish}
							loading={publishing}
							onClick={() => onPublishFinding?.(publishableFinding)}
							size="xs"
						>
							Publish comment
						</Button>
					</HStack>
					<MarkdownContent>{finding.body}</MarkdownContent>
				</Stack>
				<FindingDiffPreview
					diff={diff}
					finding={finding}
					inlineComments={referencedInlineComments}
				/>
				<Stack gap="2" minW="0">
					<Box color="fg.muted" fontWeight="semibold" textStyle="xs">
						Comment
					</Box>
					<Textarea
						boxSizing="border-box"
						color="fg.default"
						display="block"
						minH="8rem"
						onChange={(event) => setCommentBody(event.target.value)}
						placeholder="Edit the comment before publishing..."
						resize="vertical"
						value={commentBody}
						variant="surface"
						w="100%"
					/>
				</Stack>
				<HStack color="fg.muted" justify="space-between" textStyle="xs">
					<Box color="cyan.11">
						{finding.filePath}
						{finding.lineStart ? `:${finding.lineStart}` : ''}
					</Box>
					<Box>{Math.round(finding.confidence * 100)}% confidence</Box>
				</HStack>
			</Stack>
		</Box>
	)
}

function FindingDiffPreview({
	diff,
	finding,
	inlineComments,
}: {
	diff: string
	finding: PiReviewFinding
	inlineComments: PiInlineComment[]
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

type FocusedPatchLine = {
	additionLineNumber?: number
	deletionLineNumber?: number
	prefix: ' ' | '+' | '-'
	text: string
}

function getFocusedFileDiff(fileDiff: FileDiffMetadata, lineNumber: number) {
	const contextRadius = 3
	const hunk = findHunkForRightLine(fileDiff, lineNumber)
	if (!hunk) return null

	const patchLines = getFocusedPatchLines(
		fileDiff,
		hunk,
		lineNumber - contextRadius,
		lineNumber + contextRadius,
	)
	if (!patchLines.some((line) => line.additionLineNumber === lineNumber)) return null

	return parsePatch(buildFocusedPatch(fileDiff, patchLines, hunk.hunkContext)).files[0] ?? null
}

function findHunkForRightLine(fileDiff: FileDiffMetadata, lineNumber: number) {
	return (
		fileDiff.hunks.find(
			(hunk) =>
				lineNumber >= hunk.additionStart &&
				lineNumber < hunk.additionStart + hunk.additionCount,
		) ?? null
	)
}

function getFocusedPatchLines(
	fileDiff: FileDiffMetadata,
	hunk: FileDiffMetadata['hunks'][number],
	windowStart: number,
	windowEnd: number,
) {
	const patchLines: FocusedPatchLine[] = []

	for (const content of hunk.hunkContent) {
		if (content.type === 'context') {
			for (let offset = 0; offset < content.lines; offset += 1) {
				const additionLineNumber = getAdditionLineNumber(
					hunk,
					content.additionLineIndex,
					offset,
				)
				if (additionLineNumber < windowStart || additionLineNumber > windowEnd) continue

				patchLines.push({
					additionLineNumber,
					deletionLineNumber: getDeletionLineNumber(hunk, content.deletionLineIndex, offset),
					prefix: ' ',
					text: fileDiff.additionLines[content.additionLineIndex + offset] ?? '',
				})
			}
			continue
		}

		const additionLines = Array.from({ length: content.additions }, (_, offset) => ({
			additionLineNumber: getAdditionLineNumber(hunk, content.additionLineIndex, offset),
			prefix: '+' as const,
			text: fileDiff.additionLines[content.additionLineIndex + offset] ?? '',
		})).filter(
			(line) => line.additionLineNumber >= windowStart && line.additionLineNumber <= windowEnd,
		)
		if (additionLines.length === 0) continue

		for (let offset = 0; offset < content.deletions; offset += 1) {
			patchLines.push({
				deletionLineNumber: getDeletionLineNumber(hunk, content.deletionLineIndex, offset),
				prefix: '-',
				text: fileDiff.deletionLines[content.deletionLineIndex + offset] ?? '',
			})
		}
		patchLines.push(...additionLines)
	}

	return patchLines
}

function buildFocusedPatch(
	fileDiff: FileDiffMetadata,
	patchLines: FocusedPatchLine[],
	hunkContext?: string,
) {
	const oldPath = fileDiff.prevName ?? fileDiff.name
	const deletionStart = patchLines.find((line) => line.deletionLineNumber)?.deletionLineNumber ?? 0
	const additionStart = patchLines.find((line) => line.additionLineNumber)?.additionLineNumber ?? 0
	const deletionCount = patchLines.filter((line) => line.prefix !== '+').length
	const additionCount = patchLines.filter((line) => line.prefix !== '-').length
	const hunkHeader = `@@ -${formatHunkRange(deletionStart, deletionCount)} +${formatHunkRange(
		additionStart,
		additionCount,
	)} @@${hunkContext ? ` ${hunkContext}` : ''}`

	return [
		`diff --git a/${oldPath} b/${fileDiff.name}`,
		`--- a/${oldPath}`,
		`+++ b/${fileDiff.name}`,
		hunkHeader,
		...patchLines.map((line) => `${line.prefix}${line.text}`),
	].join('\n')
}

function formatHunkRange(start: number, count: number) {
	return count === 1 ? String(start) : `${start},${count}`
}

function getAdditionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.additionStart + (lineIndex - hunk.additionLineIndex) + offset
}

function getDeletionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.deletionStart + (lineIndex - hunk.deletionLineIndex) + offset
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
