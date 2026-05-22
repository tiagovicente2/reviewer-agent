import { useEffect, useState } from 'react'
import { Box, Grid, Stack } from 'styled-system/jsx'
import type { AsyncState, ColorMode } from '@/app/types'
import { StatusCard } from '@/components/common'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Button, Card } from '@/components/ui'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type {
	PiGeneratedReview,
	PiInlineComment,
	PiReviewFinding,
	PiReviewSubmitEvent,
} from '@/shared/review'
import { ChangedFilesTree } from './changed-files-tree/ChangedFilesTree'
import { DiffViewer } from './diff-viewer/DiffViewer'
import { GeneratedFindings } from './GeneratedFindings'

export function ReviewTab({
	generationError,
	generationMessage,
	generationState,
	generatedReview,
	publishError,
	onPublishFinding,
	onSubmitReview,
	publishingFindingIds,
	submittingReviewEvent,
}: {
	generationError: string
	generationMessage: string
	generationState: AsyncState
	generatedReview: PiGeneratedReview | null
	publishError: string
	onPublishFinding: (finding: PiReviewFinding) => void
	onSubmitReview: (params: {
		body: string
		event: PiReviewSubmitEvent
		findings?: PiReviewFinding[]
	}) => void
	publishingFindingIds: Set<string>
	submittingReviewEvent: PiReviewSubmitEvent | null
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
						error={generationError || publishError}
						generationMessage={generationMessage}
						generationState={generationState}
						onPublishFinding={onPublishFinding}
						onSubmitReview={onSubmitReview}
						publishingFindingIds={publishingFindingIds}
						submittingReviewEvent={submittingReviewEvent}
						review={generatedReview}
					/>
				</Box>
			</Card.Body>
		</Card.Root>
	)
}

export function CodeTab({
	colorMode,
	detail,
	detailState,
	diff,
	diffError,
	diffState,
	firstDiffFilePath,
	inlineComments,
	onLoadDiff,
}: {
	colorMode: ColorMode
	detail: GitHubPullRequestDetails | null
	detailState: AsyncState
	diff: string
	diffError: string
	diffState: AsyncState
	firstDiffFilePath: string | null
	inlineComments: PiInlineComment[]
	onLoadDiff: () => Promise<string>
}) {
	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

	useEffect(() => {
		if (!detail) {
			setSelectedFilePath(null)
			return
		}

		setSelectedFilePath(firstDiffFilePath ?? detail.files[0]?.path ?? null)
	}, [detail, firstDiffFilePath])

	if (detailState === 'loading' || !detail || (!diff && !diffError)) {
		return (
			<Stack h="100%" placeContent="center" alignItems="center" textAlign="center">
				<StatusCard
					title="Loading pull request"
					body="Loading PR metadata, changed files, and diff before showing the code view..."
				/>
			</Stack>
		)
	}

	return (
		<Grid
			gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: '24rem minmax(0, 1fr)' }}
			gap="5"
			h="100%"
			minH="0"
			minW="0"
			overflow="hidden"
		>
			<Card.Root
				h="100%"
				maxH={{ base: '24rem', xl: '100%' }}
				minH="0"
				overflow="hidden"
				variant="outline"
			>
				<Card.Header>
					<Card.Title>Changed files</Card.Title>
					<Card.Description truncate>{detail?.files.length ?? 0} edited files</Card.Description>
				</Card.Header>
				<Card.Body minH="0" overflow="hidden">
					{detail ? (
						<ChangedFilesTree
							colorMode={colorMode}
							files={detail.files}
							onSelectFile={setSelectedFilePath}
							selectedFilePath={selectedFilePath}
						/>
					) : null}
				</Card.Body>
			</Card.Root>

			<Card.Root
				h="100%"
				maxH={{ base: '70vh', xl: '100%' }}
				maxW="100%"
				minH="0"
				minW="0"
				overflow="hidden"
				variant="outline"
			>
				<Card.Body minH="0" overflow="hidden" py="4">
					<Box h="100%" minH="0" overflow="auto" pr="3" scrollbarGutter="stable">
						{diff ? (
							<DiffViewer
								colorMode={colorMode}
								inlineComments={inlineComments}
								onSelectFile={setSelectedFilePath}
								patch={diff}
								selectedFilePath={selectedFilePath}
							/>
						) : (
							<Stack h="100%" placeContent="center" alignItems="center" gap="4" textAlign="center">
								<StatusCard
									tone={diffError ? 'red' : 'gray'}
									title={diffError ? 'Could not load diff' : 'Loading diff'}
									body={diffError || 'Loading the patch in the background...'}
								/>
								{diffError ? (
									<Button loading={diffState === 'loading'} onClick={() => void onLoadDiff()}>
										Retry loading diff
									</Button>
								) : null}
							</Stack>
						)}
					</Box>
				</Card.Body>
			</Card.Root>
		</Grid>
	)
}

export function SummaryTab({ detail }: { detail: GitHubPullRequestDetails | null }) {
	return (
		<Card.Root h="100%" minH="0" overflow="hidden" variant="outline">
			<Card.Header flexShrink="0">
				<Card.Title>Pull request summary</Card.Title>
				<Card.Description>
					{detail
						? `${detail.headRefName} → ${detail.baseRefName} · ${detail.changedFilesCount} files changed`
						: 'Load a pull request to see its summary.'}
				</Card.Description>
			</Card.Header>
			<Card.Body minH="0" overflow="hidden">
				<Box h="100%" minH="0" overflowY="auto" pr="3" scrollbarGutter="stable">
					<MarkdownContent>
						{detail?.body || 'This pull request does not include a description.'}
					</MarkdownContent>
				</Box>
			</Card.Body>
		</Card.Root>
	)
}
