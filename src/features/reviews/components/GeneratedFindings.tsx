import type { Dispatch, SetStateAction } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { StatusCard } from '@/components/common'
import { Badge, Textarea } from '@/components/ui'
import type { GeneratedReview, ReviewFinding } from '@/shared/review'
import { EditableFindingCard } from './EditableFindingCard'
import { ReviewProgress } from './ReviewProgress'
import { severityColorPalette } from './reviewUtils'

export function GeneratedFindings({
	diff,
	error,
	errorTitle,
	generationMessage,
	generationState,
	inlineComments,
	onPublishFinding,
	publishableFindings,
	publishingFindingIds,
	reviewDecisionBody,
	setReviewDecisionBody,
	review,
}: {
	diff: string
	error: string
	errorTitle?: string
	generationMessage?: string
	generationState: AsyncState
	inlineComments: GeneratedReview['inlineComments']
	onPublishFinding?: (finding: ReviewFinding) => void
	publishableFindings?: ReviewFinding[]
	publishingFindingIds?: Set<string>
	reviewDecisionBody: string
	setReviewDecisionBody: Dispatch<SetStateAction<string>>
	review: GeneratedReview | null
}) {
	if (generationState === 'loading') {
		return <ReviewProgress message={generationMessage} />
	}

	if (error) {
		return <StatusCard tone="red" title={errorTitle ?? 'Review failed'} body={error} />
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
		<Stack gap="5">
			<Stack gap="2">
				<HStack gap="2">
					<Badge colorPalette={severityColorPalette(review.severity)}>{review.severity}</Badge>
					<Box color="fg.muted" textStyle="sm">
						{review.verdictRecommendation.replace('_', ' ')} recommended
					</Box>
				</HStack>
				<Box color="fg.muted" textStyle="sm">
					{review.summary}
				</Box>
			</Stack>
			{review.diffWasTruncated ? (
				<StatusCard
					title="Diff was truncated"
					body="The PR diff was too large to send in full. Review the raw diff before publishing anything."
				/>
			) : null}
			{publishableFindings?.length ? (
				<RequestChangesSection
					findings={publishableFindings}
					reviewDecisionBody={reviewDecisionBody}
					setReviewDecisionBody={setReviewDecisionBody}
				/>
			) : null}
			{review.findings.length === 0 ? (
				<StatusCard
					title="No concrete findings"
					body="The reviewer did not identify publishable findings for this diff."
				/>
			) : null}
			{review.findings.length ? (
				<Stack gap="0">
					<Box color="fg.muted" fontWeight="semibold" mb="1" textStyle="xs">
						Findings
					</Box>
					{review.findings.map((finding) => (
						<EditableFindingCard
							diff={diff}
							finding={finding}
							inlineComments={inlineComments}
							key={finding.id}
							onPublishFinding={onPublishFinding}
							publishing={publishingFindingIds?.has(finding.id) ?? false}
						/>
					))}
				</Stack>
			) : null}
		</Stack>
	)
}

function RequestChangesSection({
	findings,
	reviewDecisionBody,
	setReviewDecisionBody,
}: {
	findings: ReviewFinding[]
	reviewDecisionBody: string
	setReviewDecisionBody: Dispatch<SetStateAction<string>>
}) {
	return (
		<Stack gap="2" bg="gray.2" borderRadius="l2" p="4">
			<Stack gap="1">
				<Box fontWeight="semibold">Review message</Box>
				<Box color="fg.muted" textStyle="sm">
					Request changes will submit {findings.length} generated inline comments. This message is
					optional.
				</Box>
			</Stack>
			<Textarea
				boxSizing="border-box"
				color="fg.default"
				display="block"
				minH="6rem"
				onChange={(event) => setReviewDecisionBody(event.target.value)}
				placeholder="Add an optional review summary for GitHub..."
				resize="vertical"
				value={reviewDecisionBody}
				variant="surface"
				w="100%"
			/>
		</Stack>
	)
}
