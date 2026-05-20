import type { DiffLineAnnotation } from '@pierre/diffs/direct/types.js'
import { Box } from 'styled-system/jsx'
import { Badge } from '@/components/ui'
import type { DiffAnnotation } from './diffViewerUtils'

export function ReviewCommentAnnotation(annotation: DiffLineAnnotation<DiffAnnotation>) {
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
				<Badge colorPalette="cyan" size="sm" bg="review.commentTagBg" color="review.commentBg">
					Review comment
				</Badge>
				<Box color="black" mt="2" textStyle="sm" whiteSpace="pre-wrap" wordBreak="break-word">
					{annotation.metadata.body}
				</Box>
			</Box>
		</Box>
	)
}
