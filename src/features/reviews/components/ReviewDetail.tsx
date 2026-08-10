import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Grid, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import type { AsyncState, ColorMode } from '@/app/types'
import { StatusCard, TabButton } from '@/components/common'
import { Card } from '@/components/ui'
import type { GitHubPullRequestDetails, GitHubReviewRequest } from '@/shared/github'
import { useDiffInlineComments } from '../hooks/useDiffInlineComments'
import { useGeneratedReview } from '../hooks/useGeneratedReview'
import { usePullRequestDiff } from '../hooks/usePullRequestDiff'
import { useReviewExport } from '../hooks/useReviewExport'
import { useReviewerInstructions } from '../hooks/useReviewerInstructions'
import { codeDiffDisplaySettings } from './diff-viewer/diffDisplay'
import { ReviewDetailEmptyState } from './ReviewDetailEmptyState'
import { ReviewDetailHeader } from './ReviewDetailHeader'
import {
	ConfirmSubmitReviewModal,
	type PendingSubmitAction,
} from './review-detail/ConfirmSubmitReviewModal'
import { ReviewTabActions } from './review-detail/ReviewTabActions'
import { CodeTab } from './review-tabs/CodeTab'
import { ReviewTab } from './review-tabs/ReviewTab'
import { SummaryTab } from './review-tabs/summary/SummaryTab'

type TabId = 'code' | 'summary' | 'review'

type ReviewDetailProps = {
	colorMode: ColorMode
	detail: GitHubPullRequestDetails | null
	detailError: string
	detailState: AsyncState
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	review: GitHubReviewRequest | null
	setSummary: (summary: string) => void
}

export function ReviewDetail({
	colorMode,
	detail,
	detailError,
	detailState,
	onPullRequestDetailRefresh,
	review,
	setSummary,
}: ReviewDetailProps) {
	const [activeTab, setActiveTab] = useState<TabId>('summary')
	const [pendingSubmitAction, setPendingSubmitAction] = useState<PendingSubmitAction>(null)
	const [reviewDecisionBody, setReviewDecisionBody] = useState('')
	const { diff, diffError, diffState, loadDiff, setLoadedDiff } = usePullRequestDiff(detail)
	const handleGenerationStart = useCallback(() => setActiveTab('review'), [])
	const { instructions, selectedInstructionId, setSelectedInstructionId } =
		useReviewerInstructions()
	const {
		generateReview,
		generatedReview,
		discardFinding,
		generationError,
		generationMessage,
		generationOutputText,
		generationState,
		publishError,
		publishFinding,
		publishingFindingIds,
		submitReview,
		submittingReviewEvent,
	} = useGeneratedReview({
		detail,
		instructionId: selectedInstructionId || undefined,
		onPullRequestDetailRefresh,
		onStartGeneration: handleGenerationStart,
		onSummary: setSummary,
		onUpdatedDiff: setLoadedDiff,
	})
	const { copyReviewToClipboard, exportError, exportState, saveReviewToFile } = useReviewExport({
		detail,
		generatedReview,
	})
	const diffInlineComments = useDiffInlineComments(generatedReview)
	const publishableFindings = useMemo(
		() => generatedReview?.findings.filter(isPublishableFinding) ?? [],
		[generatedReview],
	)
	const generatedReviewId = generatedReview?.generatedAt ?? ''

	useEffect(() => {
		void generatedReviewId
		setReviewDecisionBody('')
	}, [generatedReviewId])

	const handleOpenOnGitHub = async () => {
		if (review) {
			await appRpc.request.openExternalUrl({ url: review.url })
		}
	}

	const confirmSubmitReview = () => {
		if (pendingSubmitAction === 'approve') {
			void submitReview({
				body: '',
				event: 'approve',
			})
		}

		if (pendingSubmitAction === 'request_changes') {
			void submitReview({
				body: reviewDecisionBody.trim(),
				event: 'request_changes',
				findings: publishableFindings,
			})
		}

		setPendingSubmitAction(null)
	}

	if (!review) {
		return <ReviewDetailEmptyState />
	}

	return (
		<Box
			display="grid"
			gridTemplateRows="auto minmax(0, 1fr)"
			h={{ base: 'auto', lg: '100%' }}
			minH="0"
			minW="0"
			overflow="hidden"
		>
			<ReviewDetailHeader
				detail={detail}
				detailError={detailError}
				detailState={detailState}
				generationState={generationState}
				hasGeneratedReview={Boolean(generatedReview)}
				instructions={instructions}
				onGenerateReview={generateReview}
				onOpenOnGitHub={handleOpenOnGitHub}
				onSelectInstruction={setSelectedInstructionId}
				review={review}
				selectedInstructionId={selectedInstructionId}
			/>

			<Grid
				gridTemplateColumns="minmax(0, 1fr)"
				gap="2"
				minH="0"
				minW="0"
				overflow="hidden"
				px="4"
				pb="4"
				pt="2"
			>
				<Stack gap="2" minH="0" minW="0">
					<Card.Root bg="transparent" h="100%" minH="0" overflow="hidden" variant="subtle">
						<Card.Header p="0" pb="2">
							<HStack justify="space-between" gap="3" w="100%">
								<HStack gap="0.5" p="0.5" bg="gray.2" borderRadius="l1" width="fit-content">
									<TabButton
										active={activeTab === 'summary'}
										onClick={() => setActiveTab('summary')}
									>
										Summary
									</TabButton>
									<TabButton active={activeTab === 'code'} onClick={() => setActiveTab('code')}>
										Code
									</TabButton>
									<TabButton active={activeTab === 'review'} onClick={() => setActiveTab('review')}>
										Review
									</TabButton>
								</HStack>
								{activeTab === 'review' && generatedReview ? (
									<ReviewTabActions
										approving={submittingReviewEvent === 'approve'}
										canExportReview={Boolean(detail)}
										exporting={exportState === 'loading'}
										hasPublishableFindings={Boolean(publishableFindings.length)}
										onApprove={() => setPendingSubmitAction('approve')}
										onCopy={() => void copyReviewToClipboard()}
										onExport={() => void saveReviewToFile()}
										onRequestChanges={() => setPendingSubmitAction('request_changes')}
										requestingChanges={submittingReviewEvent === 'request_changes'}
										submissionDisabled={!detail || detailState === 'loading'}
									/>
								) : null}
							</HStack>
						</Card.Header>
						<Card.Body minH="0" overflow="hidden" p="0">
							<Box display={activeTab === 'code' ? 'block' : 'none'} h="100%" minH="0">
								<CodeTab
									key={`${detail?.repo ?? review.repo}#${detail?.pullRequestNumber ?? review.pullRequestNumber}`}
									colorMode={colorMode}
									detail={detail}
									detailState={detailState}
									diff={diff}
									diffError={diffError}
									diffDisplaySettings={codeDiffDisplaySettings}
									diffState={diffState}
									inlineComments={diffInlineComments}
									onLoadDiff={loadDiff}
								/>
							</Box>
							<Box display={activeTab === 'summary' ? 'block' : 'none'} h="100%" minH="0">
								<SummaryTab detail={detail} detailState={detailState} />
							</Box>
							<Box display={activeTab === 'review' ? 'block' : 'none'} h="100%" minH="0">
								{exportState === 'error' ? (
									<Box mb="3">
										<StatusCard
											tone="red"
											title="Could not export review"
											body={
												exportError ||
												'Check clipboard permissions or the export folder in Settings.'
											}
										/>
									</Box>
								) : null}
								<ReviewTab
									generationError={generationError}
									generationMessage={generationMessage}
									generationOutputText={generationOutputText}
									generationState={generationState}
									publishError={publishError}
									diff={diff}
									generatedReview={generatedReview}
									inlineComments={diffInlineComments}
									onDiscardFinding={discardFinding}
									onPublishFinding={publishFinding}
									publishableFindings={publishableFindings}
									publishingFindingIds={publishingFindingIds}
									reviewDecisionBody={reviewDecisionBody}
									setReviewDecisionBody={setReviewDecisionBody}
								/>
							</Box>
						</Card.Body>
					</Card.Root>
				</Stack>
			</Grid>
			{pendingSubmitAction ? (
				<ConfirmSubmitReviewModal
					action={pendingSubmitAction}
					findingsCount={publishableFindings.length}
					onClose={() => setPendingSubmitAction(null)}
					onConfirm={confirmSubmitReview}
					submitting={submittingReviewEvent === pendingSubmitAction}
				/>
			) : null}
		</Box>
	)
}

function isPublishableFinding(finding: {
	filePath: string
	lineStart?: number
	suggestedCommentBody?: string
	body: string
}) {
	return Boolean(
		finding.filePath && finding.lineStart && (finding.suggestedCommentBody || finding.body),
	)
}
