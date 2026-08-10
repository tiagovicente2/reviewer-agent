import type { Dispatch, SetStateAction } from 'react'
import { Box } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { Card } from '@/components/ui'
import type { GeneratedReview, ReviewFinding, ReviewInlineComment } from '@/shared/review'
import { GeneratedFindings } from '../GeneratedFindings'

export function ReviewTab({
	diff,
	generationError,
	generationMessage,
	generationOutputText,
	generationState,
	generatedReview,
	inlineComments,
	onDiscardFinding,
	publishError,
	onPublishFinding,
	publishableFindings,
	publishingFindingIds,
	reviewDecisionBody,
	setReviewDecisionBody,
}: {
	diff: string
	generationError: string
	generationMessage: string
	generationOutputText: string
	generationState: AsyncState
	generatedReview: GeneratedReview | null
	inlineComments: ReviewInlineComment[]
	onDiscardFinding: (findingId: string) => void
	publishError: string
	onPublishFinding: (finding: ReviewFinding) => void
	publishableFindings: ReviewFinding[]
	publishingFindingIds: Set<string>
	reviewDecisionBody: string
	setReviewDecisionBody: Dispatch<SetStateAction<string>>
}) {
	return (
		<Card.Root h="100%" minH="0" overflow="hidden" variant="outline">
			<Card.Body minH="0" overflow="hidden" py="4">
				<Box
					boxSizing="border-box"
					h="100%"
					minH="0"
					overflowY="auto"
					pr="3"
					scrollbarGutter="stable"
					textAlign={generatedReview ? 'left' : 'center'}
					w="100%"
				>
					<GeneratedFindings
						diff={diff}
						error={generationError || publishError}
						errorTitle={publishError ? 'Review submission failed' : 'Review generation failed'}
						generationMessage={generationMessage}
						generationOutputText={generationOutputText}
						generationState={generationState}
						inlineComments={inlineComments}
						onDiscardFinding={onDiscardFinding}
						onPublishFinding={onPublishFinding}
						publishableFindings={publishableFindings}
						publishingFindingIds={publishingFindingIds}
						review={generatedReview}
						reviewDecisionBody={reviewDecisionBody}
						setReviewDecisionBody={setReviewDecisionBody}
					/>
				</Box>
			</Card.Body>
		</Card.Root>
	)
}
