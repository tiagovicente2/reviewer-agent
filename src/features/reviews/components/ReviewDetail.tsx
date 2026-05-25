import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Grid, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import type { AsyncState, ColorMode } from '@/app/types'
import { formatDate } from '@/app/utils'
import { StatusCard, TabButton } from '@/components/common'
import { Badge, Button, Card } from '@/components/ui'
import type { GitHubPullRequestDetails, GitHubReviewRequest } from '@/shared/github'
import { useDiffInlineComments } from '../hooks/useDiffInlineComments'
import { useGeneratedReview } from '../hooks/useGeneratedReview'
import { usePullRequestDiff } from '../hooks/usePullRequestDiff'
import { codeDiffDisplaySettings } from './diff-viewer/DiffDisplay'
import { CodeTab, ReviewTab, SummaryTab } from './ReviewDetailTabs'

type TabId = 'code' | 'summary' | 'review'
type PendingSubmitAction = 'approve' | 'request_changes' | null

export function ReviewDetail({
	colorMode,
	detail,
	detailError,
	detailState,
	review,
	setSummary,
}: {
	colorMode: ColorMode
	detail: GitHubPullRequestDetails | null
	detailError: string
	detailState: AsyncState
	review: GitHubReviewRequest | null
	setSummary: (summary: string) => void
}) {
	const [activeTab, setActiveTab] = useState<TabId>('summary')
	const [pendingSubmitAction, setPendingSubmitAction] = useState<PendingSubmitAction>(null)
	const [reviewDecisionBody, setReviewDecisionBody] = useState('')
	const { diff, diffError, diffState, loadDiff } = usePullRequestDiff(detail)
	const handleGenerationStart = useCallback(() => setActiveTab('review'), [])
	const {
		generateReview,
		generatedReview,
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
		loadDiff,
		onStartGeneration: handleGenerationStart,
		onSummary: setSummary,
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
		return (
			<Grid h="100%" minH="0" overflowY="auto" placeItems="center" p="8">
				<StatusCard
					title="Select a pull request"
					body="Your GitHub review requests will appear in the inbox."
				/>
			</Grid>
		)
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
			<Box bg="gray.1" px="8" py="3">
				<Grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="4">
					<Stack gap="1" minW="0">
						<HStack flexWrap="wrap" gap="2" color="fg.muted" textStyle="sm">
							<Badge colorPalette="cyan">requested review</Badge>
							<Badge colorPalette="gray" variant="surface">
								{detailState === 'loading' ? 'loading' : review.state}
							</Badge>
							<Box>{detail?.changedFilesCount ?? '—'} files</Box>
							<Box color="green.11">+{detail?.additions ?? '—'}</Box>
							<Box color="red.11">-{detail?.deletions ?? '—'}</Box>
							{detail?.headSha ? <Box>head {detail.headSha.slice(0, 7)}</Box> : null}
						</HStack>
						<Box as="h2" textStyle="xl" fontWeight="bold" letterSpacing="-0.03em" truncate>
							#{review.pullRequestNumber} {review.title}
						</Box>
						<Box color="fg.muted" textStyle="sm" truncate>
							{review.repo} by @{review.author} · updated {formatDate(review.updatedAt)}
						</Box>
					</Stack>

					<HStack gap="2">
						<Button
							disabled={!detail || detailState === 'loading'}
							loading={generationState === 'loading'}
							onClick={generateReview}
							size="sm"
						>
							{generatedReview ? 'Regenerate review' : 'Generate review'}
						</Button>
						<Button onClick={handleOpenOnGitHub} size="sm" variant="outline">
							Open on GitHub
						</Button>
					</HStack>
				</Grid>
				{detailError ? (
					<Box mt="4">
						<StatusCard tone="red" title="Could not load PR details" body={detailError} />
					</Box>
				) : null}
			</Box>

			<Grid
				gridTemplateColumns="minmax(0, 1fr)"
				gap="4"
				minH="0"
				minW="0"
				overflow="hidden"
				px="8"
				pb="8"
				pt="4"
			>
				<Stack gap="5" minH="0" minW="0">
					<Card.Root h="100%" minH="0" overflow="hidden">
						<Card.Header>
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
									<HStack gap="2">
										<Button
											disabled={!detail || detailState === 'loading'}
											loading={submittingReviewEvent === 'approve'}
											onClick={() => setPendingSubmitAction('approve')}
											size="sm"
											variant="outline"
										>
											Approve
										</Button>
										{publishableFindings.length ? (
											<Button
												disabled={!detail || detailState === 'loading'}
												loading={submittingReviewEvent === 'request_changes'}
												onClick={() => setPendingSubmitAction('request_changes')}
												size="sm"
											>
												Request changes
											</Button>
										) : null}
									</HStack>
								) : null}
							</HStack>
						</Card.Header>
						<Card.Body minH="0" overflow="hidden">
							<Box display={activeTab === 'code' ? 'block' : 'none'} h="100%" minH="0">
								<CodeTab
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
								<SummaryTab detail={detail} />
							</Box>
							<Box display={activeTab === 'review' ? 'block' : 'none'} h="100%" minH="0">
								<ReviewTab
									generationError={generationError}
									generationMessage={generationMessage}
									generationOutputText={generationOutputText}
									generationState={generationState}
									publishError={publishError}
									diff={diff}
									generatedReview={generatedReview}
									inlineComments={diffInlineComments}
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

function ConfirmSubmitReviewModal({
	action,
	findingsCount,
	onClose,
	onConfirm,
	submitting,
}: {
	action: Exclude<PendingSubmitAction, null>
	findingsCount: number
	onClose: () => void
	onConfirm: () => void
	submitting: boolean
}) {
	const isRequestChanges = action === 'request_changes'

	return (
		<Box
			alignItems="center"
			bg="black/40"
			display="flex"
			inset="0"
			justifyContent="center"
			onClick={submitting ? undefined : onClose}
			position="fixed"
			zIndex="modal"
		>
			<Box
				bg="gray.1"
				borderColor="gray.4"
				borderRadius="l3"
				borderWidth="1px"
				boxShadow="2xl"
				maxW="28rem"
				onClick={(event) => event.stopPropagation()}
				p="6"
				w="100%"
			>
				<Stack gap="4">
					<Box>
						<Box fontWeight="bold" textStyle="lg">
							{isRequestChanges ? 'Request changes?' : 'Approve pull request?'}
						</Box>
						<Box color="fg.muted" mt="1" textStyle="sm">
							{isRequestChanges
								? `This will submit a request changes review with ${findingsCount} generated inline comment${findingsCount === 1 ? '' : 's'}.`
								: 'This will approve the pull request on GitHub.'}
						</Box>
					</Box>
					<HStack gap="2" justify="flex-end">
						<Button disabled={submitting} onClick={onClose} variant="outline">
							Cancel
						</Button>
						<Button loading={submitting} onClick={onConfirm}>
							{isRequestChanges ? 'Request changes' : 'Approve'}
						</Button>
					</HStack>
				</Stack>
			</Box>
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
