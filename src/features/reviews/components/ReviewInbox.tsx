import { Box, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { Button } from '@/components/ui'
import type { GitHubReviewRequest } from '@/shared/github'
import type { UpdateStatus } from '@/shared/update'
import { ReviewInboxHeader } from './inbox/ReviewInboxHeader'
import { ReviewRequestList } from './inbox/ReviewRequestList'
import { ReviewSearchBar } from './inbox/ReviewSearchBar'
import type { SearchMode } from './inbox/types'
import { UpdateHint } from './UpdateHint'

export function ReviewInbox({
	canReviewPrQuery,
	collapsed,
	onClearSearch,
	onCollapse,
	onRefresh,
	onOpenSettings,
	onReviewPr,
	onSearch,
	onSelectReview,
	query,
	reviews,
	reviewPrState,
	reviewsState,
	searchActive,
	searchMode,
	showResetAction,
	selectedReviewId,
	setQuery,
	setSearchMode,
	updateStatus,
	username,
}: {
	canReviewPrQuery: boolean
	collapsed: boolean
	onClearSearch: () => void
	onCollapse: () => void
	onRefresh: () => void
	onOpenSettings: () => void
	onReviewPr: () => void
	onSearch: () => void
	onSelectReview: (id: string) => void
	query: string
	reviews: GitHubReviewRequest[]
	reviewPrState: AsyncState
	reviewsState: AsyncState
	searchActive: boolean
	searchMode: SearchMode
	showResetAction: boolean
	selectedReviewId: string | null
	setQuery: (query: string) => void
	setSearchMode: (mode: SearchMode) => void
	updateStatus: UpdateStatus | null
	username?: string
}) {
	return (
		<Box
			borderRightWidth={{ base: '0', lg: '1px' }}
			bg="gray.2"
			h={collapsed ? { base: '2.5rem', lg: '100%' } : { base: 'auto', lg: '100%' }}
			id="review-inbox-pane"
			minH="0"
			overflowY={collapsed ? 'hidden' : { base: 'visible', lg: 'auto' }}
			p={collapsed ? '0' : '5'}
		>
			<Stack display={collapsed ? 'none' : 'flex'} gap="5" id="review-inbox-content">
				<UpdateHint status={updateStatus} />
				<ReviewInboxHeader
					onCollapse={onCollapse}
					onOpenSettings={onOpenSettings}
					onRefresh={onRefresh}
					reviewsState={reviewsState}
					username={username}
				/>
				<ReviewSearchBar
					canReviewPrQuery={canReviewPrQuery}
					onClearSearch={onClearSearch}
					onReviewPr={onReviewPr}
					onSearch={onSearch}
					query={query}
					reviewPrState={reviewPrState}
					reviewsState={reviewsState}
					searchMode={searchMode}
					setQuery={setQuery}
					setSearchMode={setSearchMode}
					showResetAction={showResetAction}
				/>
				<ReviewRequestList
					groupByReviewRequest={!searchActive}
					onSelectReview={onSelectReview}
					reviews={reviews}
					reviewsState={reviewsState}
					selectedReviewId={selectedReviewId}
				/>
			</Stack>
			<Box
				alignItems="center"
				display={collapsed ? 'flex' : 'none'}
				h="full"
				justifyContent="center"
			>
				<Button
					aria-controls="review-inbox-content"
					aria-expanded={false}
					aria-label="Show review inbox"
					h="full"
					onClick={onCollapse}
					px="0"
					size="2xs"
					variant="plain"
					w="full"
				>
					<Box aria-hidden="true" fontSize="lg">
						›
					</Box>
					<Box as="span" display={{ base: 'inline', lg: 'none' }}>
						Show review inbox
					</Box>
				</Button>
			</Box>
		</Box>
	)
}
