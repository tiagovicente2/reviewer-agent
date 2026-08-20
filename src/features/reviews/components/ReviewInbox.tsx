import { useState } from 'react'
import { Box, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { Button } from '@/components/ui'
import { UpdateModal } from '@/features/settings/components/UpdateModal'
import type { GitHubReviewRequest } from '@/shared/github'
import type { UpdateStatus } from '@/shared/update'
import { ChevronRightIcon } from './inbox/InboxIcons'
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
	const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)

	return (
		<Box
			borderRightWidth={collapsed ? { base: '0', lg: '1px' } : '0'}
			bg="gray.2"
			h={collapsed ? { base: '2.5rem', lg: '100%' } : { base: 'auto', lg: '100%' }}
			id="review-inbox-pane"
			minH="0"
			overflowY={collapsed ? 'hidden' : { base: 'visible', lg: 'auto' }}
			p={collapsed ? '0' : '5'}
		>
			<Stack display={collapsed ? 'none' : 'flex'} gap="5" id="review-inbox-content">
				<ReviewInboxHeader
					onCollapse={onCollapse}
					onOpenSettings={onOpenSettings}
					onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
					onRefresh={onRefresh}
					reviewsState={reviewsState}
					updateStatus={updateStatus}
					username={username}
				/>
				<UpdateHint status={updateStatus} />
				{isUpdateModalOpen && <UpdateModal onClose={() => setIsUpdateModalOpen(false)} />}
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
					onRetry={onRefresh}
					onSelectReview={onSelectReview}
					reviews={reviews}
					reviewsState={reviewsState}
					selectedReviewId={selectedReviewId}
				/>
			</Stack>
			<Box display={collapsed ? 'flex' : 'none'} justifyContent="flex-end">
				<Button
					aria-controls="review-inbox-content"
					aria-expanded={false}
					aria-label="Show review inbox"
					h="10"
					onClick={onCollapse}
					p="0"
					size="2xs"
					title="Show review inbox"
					variant="plain"
					w="full"
				>
					<ChevronRightIcon />
				</Button>
			</Box>
		</Box>
	)
}
