import { Box, Grid, HStack, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { formatDate } from '@/app/utils'
import { StatusCard } from '@/components/common'
import { Badge, Button, Select } from '@/components/ui'
import type { GitHubPullRequestDetails, GitHubReviewRequest } from '@/shared/github'
import type { ReviewerInstruction } from '@/shared/settings'

export function ReviewDetailHeader({
	detail,
	detailError,
	detailState,
	generationState,
	hasGeneratedReview,
	instructions,
	onGenerateReview,
	onOpenOnGitHub,
	onSelectInstruction,
	review,
	selectedInstructionId,
}: {
	detail: GitHubPullRequestDetails | null
	detailError: string
	detailState: AsyncState
	generationState: AsyncState
	hasGeneratedReview: boolean
	instructions: ReviewerInstruction[]
	onGenerateReview: () => void | Promise<void>
	onOpenOnGitHub: () => void | Promise<void>
	onSelectInstruction: (instructionId: string) => void
	review: GitHubReviewRequest
	selectedInstructionId: string
}) {
	const reviewStatus = getPullRequestReviewStatus(detail)

	return (
		<Box bg="gray.1" px="4" py="2">
			<Grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="4">
				<Stack gap="1" minW="0">
					<HStack flexWrap="wrap" gap="2" color="fg.muted" textStyle="sm">
						<Badge colorPalette={reviewStatus.colorPalette}>{reviewStatus.label}</Badge>
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
					{instructions.length > 1 ? (
						<Select
							disabled={generationState === 'loading'}
							label="Reviewer instructions"
							onChange={onSelectInstruction}
							options={instructions.map((instruction) => ({
								label: instruction.name || 'Untitled',
								value: instruction.id,
							}))}
							placeholder="Instructions"
							value={selectedInstructionId}
							width="11rem"
						/>
					) : null}
					<Button
						disabled={!detail || detailState === 'loading'}
						loading={generationState === 'loading'}
						onClick={onGenerateReview}
						size="sm"
					>
						{hasGeneratedReview ? 'Regenerate review' : 'Generate review'}
					</Button>
					<Button onClick={onOpenOnGitHub} size="sm" variant="outline">
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
	)
}

function getPullRequestReviewStatus(detail: GitHubPullRequestDetails | null): {
	colorPalette: 'cyan' | 'green' | 'red' | 'gray'
	label: string
} {
	if (detail?.reviewDecision === 'CHANGES_REQUESTED') {
		return { colorPalette: 'red', label: 'changes requested' }
	}
	if (detail?.reviewDecision === 'APPROVED') {
		return { colorPalette: 'green', label: 'approved' }
	}
	if (detail?.reviewRequests.length) {
		return { colorPalette: 'cyan', label: 'review requested' }
	}
	if (detail?.reviews.length) {
		return { colorPalette: 'gray', label: 'reviewed' }
	}
	return { colorPalette: 'cyan', label: 'review requested' }
}
