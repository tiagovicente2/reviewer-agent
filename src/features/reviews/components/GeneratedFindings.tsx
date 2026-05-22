import { useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { StatusCard } from '@/components/common'
import { Badge, Button, Card, Textarea } from '@/components/ui'
import type { PiGeneratedReview, PiReviewFinding, PiReviewSubmitEvent } from '@/shared/review'
import { EditableFindingCard } from './EditableFindingCard'
import { ReviewProgress } from './ReviewProgress'
import { severityColorPalette } from './reviewUtils'

export function GeneratedFindings({
	error,
	generationMessage,
	generationState,
	onPublishFinding,
	onSubmitReview,
	publishableFindings,
	publishingFindingIds,
	submittingReviewEvent,
	review,
}: {
	error: string
	generationMessage?: string
	generationState: AsyncState
	onPublishFinding?: (finding: PiReviewFinding) => void
	onSubmitReview?: (params: {
		body?: string
		event: PiReviewSubmitEvent
		findings?: PiReviewFinding[]
	}) => void
	publishableFindings?: PiReviewFinding[]
	publishingFindingIds?: Set<string>
	submittingReviewEvent?: PiReviewSubmitEvent | null
	review: PiGeneratedReview | null
}) {
	if (generationState === 'loading') {
		return <ReviewProgress message={generationMessage} />
	}

	if (error) {
		return <StatusCard tone="red" title="Review generation failed" body={error} />
	}

	if (!review) {
		return (
			<StatusCard
				title="No draft yet"
				body="Click Generate review to review the loaded GitHub diff and create a local draft."
			/>
		)
	}

	return (
		<Stack gap="3">
			<HStack gap="2">
				<Badge colorPalette={severityColorPalette(review.severity)}>{review.severity}</Badge>
				<Badge colorPalette="gray" variant="surface">
					{review.verdictRecommendation}
				</Badge>
			</HStack>
			<Box color="fg.muted" textStyle="sm">
				{review.summary}
			</Box>
			{review.diffWasTruncated ? (
				<StatusCard
					title="Diff was truncated"
					body="The PR diff was too large to send in full. Review the raw diff before publishing anything."
				/>
			) : null}
			{publishableFindings?.length ? (
				<RequestChangesCard
					findings={publishableFindings}
					onSubmitReview={onSubmitReview}
					submittingReviewEvent={submittingReviewEvent ?? null}
				/>
			) : null}
			{review.findings.length === 0 ? (
				<StatusCard
					title="No concrete findings"
					body="The reviewer did not identify publishable findings for this diff."
				/>
			) : null}
			{review.findings.map((finding) => (
				<EditableFindingCard
					finding={finding}
					key={finding.id}
					onPublishFinding={onPublishFinding}
					publishing={publishingFindingIds?.has(finding.id) ?? false}
				/>
			))}
		</Stack>
	)
}

function RequestChangesCard({
	findings,
	onSubmitReview,
	submittingReviewEvent,
}: {
	findings: PiReviewFinding[]
	onSubmitReview?: (params: {
		body?: string
		event: PiReviewSubmitEvent
		findings?: PiReviewFinding[]
	}) => void
	submittingReviewEvent: PiReviewSubmitEvent | null
}) {
	const [reviewBody, setReviewBody] = useState('')
	const canSubmit = !submittingReviewEvent

	return (
		<Card.Root variant="outline">
			<Card.Body p="4">
				<Stack gap="3">
					<HStack justify="space-between" gap="3" alignItems="flex-start">
						<Stack gap="1">
							<Box fontWeight="semibold">Request changes</Box>
							<Box color="fg.muted" textStyle="sm">
								Submit a GitHub review with {findings.length} generated inline comments.
							</Box>
						</Stack>
						<HStack gap="2">
							<Button
								disabled={!canSubmit}
								loading={submittingReviewEvent === 'request_changes'}
								onClick={() =>
									onSubmitReview?.({
										body: reviewBody.trim(),
										event: 'request_changes',
										findings,
									})
								}
								size="sm"
							>
								Request changes
							</Button>
						</HStack>
					</HStack>
					<Textarea
						boxSizing="border-box"
						color="fg.default"
						display="block"
						minH="7rem"
						onChange={(event) => setReviewBody(event.target.value)}
						placeholder="Add the review summary that GitHub will publish with the decision..."
						resize="vertical"
						value={reviewBody}
						variant="surface"
						w="100%"
					/>
				</Stack>
			</Card.Body>
		</Card.Root>
	)
}
