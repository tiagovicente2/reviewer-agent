import { Box, Grid } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Card } from '@/components/ui'
import type { GitHubPullRequestDetails } from '@/shared/github'
import { ReviewersPanel } from './ReviewersPanel'
import { SummaryTabSkeleton } from './SummaryTabSkeleton'

export function SummaryTab({
	detail,
	detailState,
}: {
	detail: GitHubPullRequestDetails | null
	detailState: AsyncState
}) {
	if (detailState === 'loading') return <SummaryTabSkeleton />

	return (
		<Grid
			gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 14rem' }}
			gap="2"
			h="100%"
			minH="0"
			overflow={{ base: 'auto', xl: 'hidden' }}
		>
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
			<ReviewersPanel detail={detail} />
		</Grid>
	)
}
