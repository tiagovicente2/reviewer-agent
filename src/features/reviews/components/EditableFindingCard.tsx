import { css } from 'styled-system/css'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Badge, Button, Textarea } from '@/components/ui'
import type { ReviewFinding, ReviewInlineComment } from '@/shared/review'
import {
	getFindingCommentBody,
	getReviewCommentKey,
	isPublishableFinding,
} from '@/shared/review-publication'
import { FindingDiffPreview } from './finding-diff/FindingDiffPreview'
import { severityColorPalette } from './reviewUtils'

export function EditableFindingCard({
	diff,
	finding,
	inlineComments,
	onChangeCommentBody,
	onDiscardFinding,
	onPublishFinding,
	publishing,
}: {
	diff: string
	finding: ReviewFinding
	inlineComments: ReviewInlineComment[]
	onChangeCommentBody: (findingId: string, commentBody: string) => void
	onDiscardFinding?: (findingId: string) => void
	onPublishFinding?: (finding: ReviewFinding) => void
	publishing: boolean
}) {
	const commentBody = getFindingCommentBody(finding)
	const commentFieldId = `finding-comment-${finding.id}`
	const published = finding.publication?.state === 'published'
	const canPublish = isPublishableFinding(finding)
	const publishableFinding = {
		...finding,
		suggestedCommentBody: commentBody.trim(),
	}
	const referencedInlineComments = inlineComments.filter(
		(comment) =>
			comment.side === 'RIGHT' &&
			getReviewCommentKey(comment) ===
				getReviewCommentKey({
					body: getFindingCommentBody(finding),
					line: finding.lineStart,
					path: finding.filePath,
				}),
	)

	return (
		<Box borderTopWidth="1px" maxW="100%" overflow="visible" py="5">
			<Stack gap="4" minW="0" overflow="visible">
				<Stack gap="3">
					<HStack justify="space-between" gap="3" alignItems="flex-start">
						<Stack gap="2" minW="0">
							<HStack gap="2">
								<Badge colorPalette={severityColorPalette(finding.severity)}>
									{finding.severity}
								</Badge>
								{published ? <Badge colorPalette="green">Published</Badge> : null}
							</HStack>
							<Box fontWeight="semibold">{finding.title}</Box>
						</Stack>
						<HStack gap="2">
							{published ? null : (
								<Button
									colorPalette="red"
									disabled={publishing}
									onClick={() => onDiscardFinding?.(finding.id)}
									size="xs"
									variant="outline"
								>
									Discard comment
								</Button>
							)}
							<Button
								disabled={published || !canPublish}
								loading={publishing}
								onClick={() => onPublishFinding?.(publishableFinding)}
								size="xs"
							>
								{published ? 'Published' : 'Publish comment'}
							</Button>
						</HStack>
					</HStack>
					<MarkdownContent>{finding.body}</MarkdownContent>
				</Stack>
				<FindingDiffPreview
					diff={diff}
					finding={finding}
					inlineComments={referencedInlineComments}
				/>
				<Stack gap="2" minW="0">
					<label
						className={css({ color: 'fg.muted', fontWeight: 'semibold', textStyle: 'xs' })}
						htmlFor={commentFieldId}
					>
						Comment
					</label>
					<Textarea
						disabled={published}
						id={commentFieldId}
						boxSizing="border-box"
						color="fg.default"
						display="block"
						minH="8rem"
						onChange={(event) => onChangeCommentBody(finding.id, event.target.value)}
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
