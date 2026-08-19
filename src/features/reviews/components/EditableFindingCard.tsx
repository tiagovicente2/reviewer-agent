import { Box, HStack, Stack } from 'styled-system/jsx'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Badge, Button, Textarea } from '@/components/ui'
import type { ReviewFinding, ReviewInlineComment } from '@/shared/review'
import { getFindingCommentBody } from '@/shared/review-publication'
import { findPatchFile } from './diff-viewer/diffDisplayUtils'
import { getFindingPublishState } from './editableFindingUtils'
import { FindingDiffPreview } from './finding-diff/FindingDiffPreview'
import { getFocusedFileDiff } from './finding-diff/findingDiffPreviewUtils'
import { severityColorPalette } from './reviewUtils'

export function EditableFindingCard({
	diff,
	finding,
	onChangeCommentBody,
	onDiscardFinding,
	onPublishFinding,
	publishing,
}: {
	diff: string
	finding: ReviewFinding
	inlineComments?: ReviewInlineComment[]
	onChangeCommentBody: (findingId: string, commentBody: string) => void
	onDiscardFinding?: (findingId: string) => void
	onPublishFinding?: (finding: ReviewFinding) => void
	publishing: boolean
}) {
	const commentBody = getFindingCommentBody(finding)
	const commentFieldId = `finding-comment-${finding.id}`
	const published = finding.publication?.state === 'published'
	const publishState = getFindingPublishState(finding, commentBody)
	const hasFixSuggestion = Boolean(finding.fixSuggestion?.trim())
	const fileDiff = findPatchFile(diff, finding.filePath)
	const hasFocusedDiff = Boolean(
		fileDiff &&
			finding.lineStart &&
			getFocusedFileDiff(fileDiff, finding.lineStart, finding.lineEnd),
	)

	const lineRangeLabel = finding.lineStart
		? finding.lineEnd && finding.lineEnd > finding.lineStart
			? `:${finding.lineStart}-${finding.lineEnd}`
			: `:${finding.lineStart}`
		: ''

	const targetLine =
		typeof finding.lineEnd === 'number' &&
		typeof finding.lineStart === 'number' &&
		finding.lineEnd >= finding.lineStart
			? finding.lineEnd
			: (finding.lineStart ?? 1)

	const findingInlineComments: ReviewInlineComment[] = [
		{
			author: 'reviewer-agent',
			body: commentBody,
			disabled: published,
			line: targetLine,
			onChangeBody: (body) => onChangeCommentBody(finding.id, body),
			path: finding.filePath,
			side: 'RIGHT',
		},
	]

	return (
		<Box borderTopWidth="1px" maxW="100%" overflow="visible" py="5">
			<Stack gap="4" minW="0" overflow="visible">
				<Stack gap="3">
					<Stack gap="2" minW="0">
						<HStack gap="2">
							<Badge colorPalette={severityColorPalette(finding.severity)}>
								{finding.severity}
							</Badge>
							{published ? <Badge colorPalette="green">Published</Badge> : null}
						</HStack>
						<Box fontWeight="semibold">{finding.title}</Box>
					</Stack>
					<MarkdownContent>{finding.body}</MarkdownContent>
				</Stack>

				{hasFixSuggestion ? (
					<Stack gap="3">
						<FindingDiffPreview diff={diff} finding={finding} />
						<ReviewCommentCard
							commentBody={commentBody}
							commentFieldId={commentFieldId}
							disabled={published}
							onChangeCommentBody={(body) => onChangeCommentBody(finding.id, body)}
						/>
					</Stack>
				) : hasFocusedDiff ? (
					<FindingDiffPreview
						diff={diff}
						finding={finding}
						inlineComments={findingInlineComments}
					/>
				) : (
					<Stack gap="3">
						<FindingDiffPreview diff={diff} finding={finding} />
						<ReviewCommentCard
							commentBody={commentBody}
							commentFieldId={commentFieldId}
							disabled={published}
							onChangeCommentBody={(body) => onChangeCommentBody(finding.id, body)}
						/>
					</Stack>
				)}

				<HStack color="fg.muted" justify="space-between" textStyle="xs">
					<Box color="cyan.11">
						{finding.filePath}
						{lineRangeLabel}
					</Box>
					<Box>{Math.round(finding.confidence * 100)}% confidence</Box>
				</HStack>
				<HStack gap="2" justify="flex-end">
					{published ? (
						<Button disabled size="sm">
							Published
						</Button>
					) : (
						<>
							<Button
								disabled={publishing}
								onClick={() => onDiscardFinding?.(finding.id)}
								size="sm"
								variant="plain"
							>
								Discard draft
							</Button>
							<Button
								disabled={!publishState.canPublish}
								loading={publishing}
								onClick={() => onPublishFinding?.(publishState.finding)}
								size="sm"
							>
								Publish comment
							</Button>
						</>
					)}
				</HStack>
			</Stack>
		</Box>
	)
}

function ReviewCommentCard({
	commentBody,
	commentFieldId,
	disabled,
	onChangeCommentBody,
}: {
	commentBody: string
	commentFieldId: string
	disabled?: boolean
	onChangeCommentBody: (body: string) => void
}) {
	return (
		<Box
			bg="review.commentBg"
			borderColor="review.commentBorder"
			borderRadius="l2"
			borderWidth="1px"
			boxSizing="border-box"
			display="flex"
			flexDirection="column"
			h="100%"
			minH="10rem"
			overflow="hidden"
			p="3"
		>
			<HStack justify="space-between" alignItems="center" mb="2">
				<HStack gap="2" minW="0">
					<Badge colorPalette="cyan" size="sm">
						Review comment
					</Badge>
					<Box color="fg.default" fontWeight="medium" textStyle="sm" truncate>
						@reviewer-agent
					</Box>
				</HStack>
				{disabled ? (
					<Badge colorPalette="green" size="sm">
						Published
					</Badge>
				) : null}
			</HStack>

			{disabled ? (
				<Box color="fg.default" flex="1" overflowY="auto" textStyle="sm" wordBreak="break-word">
					<MarkdownContent tone="comment">{commentBody}</MarkdownContent>
				</Box>
			) : (
				<Textarea
					aria-label="Edit review comment"
					bg="review.commentTextareaBg"
					borderColor="review.commentBorder"
					boxSizing="border-box"
					color="fg.default"
					disabled={disabled}
					display="block"
					flex="1"
					fontSize="sm"
					id={commentFieldId}
					lineHeight="1.6"
					minH="7rem"
					onChange={(event) => onChangeCommentBody(event.target.value)}
					placeholder="Edit the comment before publishing..."
					resize="vertical"
					value={commentBody}
					w="100%"
				/>
			)}
		</Box>
	)
}
