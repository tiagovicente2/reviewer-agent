import { Tabs } from '@ark-ui/react/tabs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { css } from 'styled-system/css'
import { Box, Grid, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import type { AsyncState, ColorMode } from '@/app/types'
import { StatusCard, TabButton } from '@/components/common'
import { Card } from '@/components/ui'
import type { GitHubPullRequestDetails, GitHubReviewRequest } from '@/shared/github'
import { isPublishableFinding } from '@/shared/review-publication'
import { getReviewSubmissionPolicy } from '@/shared/review-submission'
import { useDiffInlineComments } from '../hooks/useDiffInlineComments'
import { useGeneratedReview } from '../hooks/useGeneratedReview'
import { usePullRequestDiff } from '../hooks/usePullRequestDiff'
import { useReviewExport } from '../hooks/useReviewExport'
import { useReviewerInstructions } from '../hooks/useReviewerInstructions'
import { codeDiffDisplaySettings } from './diff-viewer/diffDisplayUtils'
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
	currentUsername?: string
	detail: GitHubPullRequestDetails | null
	detailError: string
	detailState: AsyncState
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	review: GitHubReviewRequest | null
	setSummary: (summary: string) => void
}

export function ReviewDetail({
	colorMode,
	currentUsername,
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
		changeFindingComment,
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
		submittedReviewEvent,
		submittingReviewEvent,
	} = useGeneratedReview({
		currentUsername,
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
		() =>
			generatedReview?.findings.filter(
				(finding) => isPublishableFinding(finding) && !publishingFindingIds.has(finding.id),
			) ?? [],
		[generatedReview, publishingFindingIds],
	)
	const policyDetail = detailState === 'loading' ? null : detail
	const approvePolicy = getReviewSubmissionPolicy({
		currentUsername,
		detail: policyDetail,
		event: 'approve',
		publishableFindingsCount: publishableFindings.length,
		reviewedHeadSha: generatedReview?.reviewedHeadSha ?? null,
		submissionLocked: submittingReviewEvent !== null,
		submittedEvent: submittedReviewEvent,
	})
	const requestChangesPolicy = getReviewSubmissionPolicy({
		currentUsername,
		detail: policyDetail,
		event: 'request_changes',
		hasReviewBody: Boolean(reviewDecisionBody.trim()),
		publishableFindingsCount: publishableFindings.length,
		reviewedHeadSha: generatedReview?.reviewedHeadSha ?? null,
		submissionLocked: submittingReviewEvent !== null,
		submittedEvent: submittedReviewEvent,
	})
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

	const confirmSubmitReview = async () => {
		if (!pendingSubmitAction) return
		const submitted = await submitReview({
			body: pendingSubmitAction === 'request_changes' ? reviewDecisionBody.trim() : '',
			event: pendingSubmitAction,
			findings: pendingSubmitAction === 'request_changes' ? publishableFindings : undefined,
		})
		if (submitted) setPendingSubmitAction(null)
	}

	if (!review) {
		return <ReviewDetailEmptyState />
	}

	return (
		<Box
			display="grid"
			gridTemplateRows="auto minmax(0, 1fr)"
			h="100%"
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
					<Tabs.Root
						className={css({ h: '100%', minH: '0' })}
						lazyMount={false}
						onValueChange={({ value }) => setActiveTab(value as TabId)}
						unmountOnExit={false}
						value={activeTab}
					>
						<Card.Root bg="transparent" h="100%" minH="0" overflow="hidden" variant="subtle">
							<Card.Header p="0" pb="2">
								<HStack justify="space-between" gap="3" w="100%">
									<Tabs.List aria-label="Pull request review views" asChild>
										<HStack gap="0.5" p="0.5" bg="gray.2" borderRadius="l1" width="fit-content">
											<TabButton value="summary">Summary</TabButton>
											<TabButton value="code">Code</TabButton>
											<TabButton value="review">Review</TabButton>
										</HStack>
									</Tabs.List>
									{activeTab === 'review' && generatedReview ? (
										<ReviewTabActions
											approveDisabled={!approvePolicy.allowed}
											approveReason={approvePolicy.reason}
											approving={submittingReviewEvent === 'approve'}
											canExportReview={Boolean(detail)}
											exporting={exportState === 'loading'}
											hasPublishableFindings={publishableFindings.length > 0}
											onApprove={() => setPendingSubmitAction('approve')}
											onCopy={() => void copyReviewToClipboard()}
											onExport={() => void saveReviewToFile()}
											onRequestChanges={() => setPendingSubmitAction('request_changes')}
											requestChangesDisabled={!requestChangesPolicy.allowed}
											requestChangesReason={requestChangesPolicy.reason}
											requestingChanges={submittingReviewEvent === 'request_changes'}
										/>
									) : null}
								</HStack>
							</Card.Header>
							<Card.Body minH="0" overflow="hidden" p="0">
								<Tabs.Content asChild value="code">
									<Box h="100%" minH="0">
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
								</Tabs.Content>
								<Tabs.Content asChild value="summary">
									<Box h="100%" minH="0">
										<SummaryTab detail={detail} detailState={detailState} />
									</Box>
								</Tabs.Content>
								<Tabs.Content asChild value="review">
									<Box h="100%" minH="0">
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
											onChangeFindingComment={changeFindingComment}
											onDiscardFinding={discardFinding}
											onPublishFinding={publishFinding}
											publishableFindings={publishableFindings}
											publishingFindingIds={publishingFindingIds}
											reviewDecisionBody={reviewDecisionBody}
											setReviewDecisionBody={setReviewDecisionBody}
										/>
									</Box>
								</Tabs.Content>
							</Card.Body>
						</Card.Root>
					</Tabs.Root>
				</Stack>
			</Grid>
			{pendingSubmitAction ? (
				<ConfirmSubmitReviewModal
					action={pendingSubmitAction}
					findingsCount={publishableFindings.length}
					onClose={() => setPendingSubmitAction(null)}
					onConfirm={confirmSubmitReview}
					submitting={submittingReviewEvent !== null}
				/>
			) : null}
		</Box>
	)
}
