import { Box, HStack, Stack } from 'styled-system/jsx'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Badge, Button, Textarea } from '@/components/ui'
import type { ReviewFinding, ReviewInlineComment } from '@/shared/review'
import { getFindingCommentBody } from '../hooks/generated-review/reviewGenerationUtils'
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
	const canPublish = Boolean(finding.filePath && finding.lineStart && commentBody.trim())
	const publishableFinding = {
		...finding,
		suggestedCommentBody: commentBody.trim(),
	}
	const referencedInlineComments = inlineComments.filter((comment) => {
		const findingBody = getFindingCommentBody(finding).trim()
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
							<Badge alignSelf="flex-start" colorPalette={severityColorPalette(finding.severity)}>
								{finding.severity}
							</Badge>
							<Box fontWeight="semibold">{finding.title}</Box>
						</Stack>
						<HStack gap="2">
							<Button
								colorPalette="red"
								disabled={publishing}
								onClick={() => onDiscardFinding?.(finding.id)}
								size="xs"
								variant="outline"
							>
								Discard comment
							</Button>
							<Button
								disabled={!canPublish}
								loading={publishing}
								onClick={() => onPublishFinding?.(publishableFinding)}
								size="xs"
							>
								Publish comment
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
					<Box color="fg.muted" fontWeight="semibold" textStyle="xs">
						Comment
					</Box>
					<Textarea
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
