import { Box, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import type { GitHubReviewRequest } from '@/shared/github'
import type { UpdateStatus } from '@/shared/update'
import { ReviewInboxHeader } from './inbox/ReviewInboxHeader'
import { ReviewRequestList } from './inbox/ReviewRequestList'
import { ReviewSearchBar } from './inbox/ReviewSearchBar'
import type { SearchMode } from './inbox/types'
import { UpdateHint } from './UpdateHint'

export function ReviewInbox({
	canReviewPrQuery,
	onClearSearch,
	onRefresh,
	onOpenSettings,
	onReviewPr,
	onSearch,
	onSelectReview,
	query,
	reviews,
	reviewPrState,
	reviewsState,
	searchMode,
	showResetAction,
	selectedReviewId,
	setQuery,
	setSearchMode,
	updateStatus,
	username,
}: {
	canReviewPrQuery: boolean
	onClearSearch: () => void
	onRefresh: () => void
	onOpenSettings: () => void
	onReviewPr: () => void
	onSearch: () => void
	onSelectReview: (id: string) => void
	query: string
	reviews: GitHubReviewRequest[]
	reviewPrState: AsyncState
	reviewsState: AsyncState
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
			h={{ base: 'auto', lg: '100%' }}
			minH="0"
			overflowY={{ base: 'visible', lg: 'auto' }}
			p="5"
		>
			<Stack gap="5">
				<UpdateHint onOpenSettings={onOpenSettings} status={updateStatus} />
				<ReviewInboxHeader
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
					onSelectReview={onSelectReview}
					reviews={reviews}
					reviewsState={reviewsState}
					selectedReviewId={selectedReviewId}
				/>
			</Stack>
		</Box>
	)
}
