import { useCallback, useMemo, useState } from 'react'
import { Box, Grid, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import type { AsyncState, ColorMode } from '@/app/types'
import { formatDate } from '@/app/utils'
import { StatusCard, TabButton } from '@/components/common'
import { Badge, Button, Card } from '@/components/ui'
import type { GitHubPullRequestDetails, GitHubReviewRequest } from '@/shared/github'
import { useGeneratedReview } from '../hooks/useGeneratedReview'
import { usePullRequestDiff } from '../hooks/usePullRequestDiff'
import { CodeTab, ReviewTab, SummaryTab } from './ReviewDetailTabs'

type TabId = 'code' | 'summary' | 'review'

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
	const { diff, diffError, diffState, firstDiffFilePath, loadDiff } = usePullRequestDiff(detail)
	const handleGenerationStart = useCallback(() => setActiveTab('review'), [])
	const {
		generateReview,
		generatedReview,
		generationError,
		generationMessage,
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
	const diffInlineComments = useMemo(() => {
		if (!generatedReview) return []

		const comments = [...generatedReview.inlineComments]
		const existingCommentIndexes = new Map(
			comments.map((comment, index) => [
				getCommentIdentity(comment.path, comment.side, comment.body),
				index,
			]),
		)

		for (const finding of generatedReview.findings) {
			const body = finding.suggestedCommentBody?.trim()
			if (!finding.filePath || !finding.lineStart || !body) continue

			const key = getCommentIdentity(finding.filePath, 'RIGHT', body)
			const existingIndex = existingCommentIndexes.get(key)
			if (existingIndex !== undefined) {
				comments[existingIndex] = {
					...comments[existingIndex],
					body,
					line: finding.lineStart,
				}
				continue
			}

			existingCommentIndexes.set(key, comments.length)
			comments.push({
				body,
				line: finding.lineStart,
				path: finding.filePath,
				side: 'RIGHT',
			})
		}

		return comments
	}, [generatedReview])
	const publishableFindings = useMemo(
		() => generatedReview?.findings.filter(isPublishableFinding) ?? [],
		[generatedReview],
	)

	const handleOpenOnGitHub = async () => {
		if (review) {
			await appRpc.request.openExternalUrl({ url: review.url })
		}
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
							Generate review
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
											onClick={() =>
												submitReview({
													body: '',
													event: 'approve',
												})
											}
											size="sm"
											variant="outline"
										>
											Approve
										</Button>
										<Button
											disabled={!detail || detailState === 'loading'}
											loading={generationState === 'loading'}
											onClick={generateReview}
											size="sm"
											variant="outline"
										>
											Regenerate review
										</Button>
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
									diffState={diffState}
									firstDiffFilePath={firstDiffFilePath}
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
									generationState={generationState}
									publishError={publishError}
									generatedReview={generatedReview}
									onPublishFinding={publishFinding}
									onSubmitReview={submitReview}
									publishableFindings={publishableFindings}
									publishingFindingIds={publishingFindingIds}
									submittingReviewEvent={submittingReviewEvent}
								/>
							</Box>
						</Card.Body>
					</Card.Root>
				</Stack>
			</Grid>
		</Box>
	)
}

function getCommentIdentity(path: string, side: 'LEFT' | 'RIGHT', body: string) {
	return `${path}:${side}:${body.trim().replace(/\s+/g, ' ')}`
}

function isPublishableFinding(finding: {
	filePath: string
	lineStart?: number
	suggestedCommentBody?: string
	body: string
}) {
	return Boolean(finding.filePath && finding.lineStart && (finding.suggestedCommentBody || finding.body))
}
