import type { DiffLineAnnotation } from '@pierre/diffs/direct/types.js'
import { useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Badge } from '@/components/ui'
import type { DiffAnnotation } from './diffViewerUtils'

export function ReviewCommentAnnotation(annotation: DiffLineAnnotation<DiffAnnotation>) {
	const comments = annotation.metadata.comments
	const [expanded, setExpanded] = useState(false)
	const visibleComments = expanded ? comments : comments.slice(0, 1)
	const hasThread = comments.length > 1

	return (
		<Box p="2" w="100%">
			<Box
				bg="review.commentBg"
				borderColor="review.commentBorder"
				borderRadius="l2"
				borderWidth="1px"
				maxW="100%"
				minW="0"
				overflow="hidden"
				p="3"
			>
				<HStack justify="space-between" gap="3">
					<HStack gap="2" minW="0">
						<Badge colorPalette="cyan" size="sm" bg="review.commentTagBg" color="review.commentBg">
							Review comment
						</Badge>
						<Box color="black" fontWeight="medium" textStyle="sm" truncate>
							@{comments[0]?.author ?? 'reviewer-agent'}
						</Box>
					</HStack>
					{hasThread ? (
						<Box
							as="button"
							color="black"
							fontWeight="medium"
							onClick={() => setExpanded((current) => !current)}
							textStyle="xs"
						>
							{expanded ? 'Hide thread' : `Show thread (${comments.length})`}
						</Box>
					) : null}
				</HStack>
				<Stack gap="3" mt="2">
					{visibleComments.map((comment, index) => (
						<Box key={`${comment.author ?? 'reviewer-agent'}:${comment.createdAt ?? comment.body}`}>
							{index > 0 ? (
								<Box color="black" fontWeight="medium" mb="1" textStyle="sm">
									@{comment.author ?? 'reviewer-agent'}
								</Box>
							) : null}
							<Box color="black" textStyle="sm" wordBreak="break-word">
								<MarkdownContent tone="comment">{comment.body}</MarkdownContent>
							</Box>
						</Box>
					))}
				</Stack>
			</Box>
		</Box>
	)
}
