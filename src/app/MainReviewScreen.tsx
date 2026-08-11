import { type CSSProperties, lazy, Suspense, useState } from 'react'
import { Grid } from 'styled-system/jsx'
import { StatusCard } from '@/components/common'
import type { SearchMode } from '@/features/reviews/components/inbox/types'
import { PaneResizeHandle } from '@/features/reviews/components/PaneResizeHandle'
import { ReviewInbox } from '@/features/reviews/components/ReviewInbox'
import { inboxPane } from '@/features/reviews/components/workspaceLayoutUtils'
import type {
	GitHubAuthStatus,
	GitHubPullRequestDetails,
	GitHubReviewRequest,
} from '@/shared/github'
import type { UpdateStatus } from '@/shared/update'
import type { AsyncState, ColorMode } from './types'

const ReviewDetail = lazy(() =>
	import('@/features/reviews/components/ReviewDetail').then((module) => ({
		default: module.ReviewDetail,
	})),
)

type MainReviewScreenProps = {
	activeSearchQuery: string
	canReviewPrQuery: boolean
	colorMode: ColorMode
	currentAuthStatus: GitHubAuthStatus
	currentUsername?: string
	detail: GitHubPullRequestDetails | null
	detailError: string
	detailState: AsyncState
	displayedReviews: GitHubReviewRequest[]
	loadReviewRequests: () => undefined | Promise<undefined | boolean>
	onClearSearch: () => void
	onOpenSettings: () => void
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	onReviewPr: () => void | Promise<void>
	onSearch: () => void
	query: string
	reviewPrState: AsyncState
	reviewsState: AsyncState
	searchActive: boolean
	searchMode: SearchMode
	selectedReview: GitHubReviewRequest | null
	selectedReviewId: string | null
	setQuery: (query: string) => void
	setSearchMode: (mode: SearchMode) => void
	setSelectedReviewId: (id: string) => void
	setSummary: (summary: string) => void
	updateStatus: UpdateStatus | null
}

export function MainReviewScreen({
	activeSearchQuery,
	canReviewPrQuery,
	colorMode,
	currentAuthStatus,
	currentUsername,
	detail,
	detailError,
	detailState,
	displayedReviews,
	loadReviewRequests,
	onClearSearch,
	onOpenSettings,
	onPullRequestDetailRefresh,
	onReviewPr,
	onSearch,
	query,
	reviewPrState,
	reviewsState,
	searchActive,
	searchMode,
	selectedReview,
	selectedReviewId,
	setQuery,
	setSearchMode,
	setSelectedReviewId,
	setSummary,
	updateStatus,
}: MainReviewScreenProps) {
	const [inboxWidth, setInboxWidth] = useState<number>(inboxPane.defaultWidth)
	const [inboxCollapsed, setInboxCollapsed] = useState(false)

	return (
		<Grid
			style={{ '--inbox-width': `${inboxWidth}px` } as CSSProperties}
			gap="0"
			gridTemplateColumns={{
				base: 'minmax(0, 1fr)',
				lg: inboxCollapsed ? '2.5rem minmax(0, 1fr)' : 'var(--inbox-width) 0.5rem minmax(0, 1fr)',
			}}
			h="100%"
			minH="0"
			minW="0"
			overflow={{ base: 'auto', lg: 'hidden' }}
			overflowX="hidden"
		>
			<ReviewInbox
				canReviewPrQuery={canReviewPrQuery}
				collapsed={inboxCollapsed}
				onClearSearch={onClearSearch}
				onCollapse={() => setInboxCollapsed((collapsed) => !collapsed)}
				onOpenSettings={onOpenSettings}
				onRefresh={loadReviewRequests}
				onReviewPr={onReviewPr}
				onSearch={onSearch}
				onSelectReview={setSelectedReviewId}
				query={query}
				reviews={displayedReviews}
				reviewPrState={reviewPrState}
				reviewsState={reviewsState}
				searchActive={searchActive}
				searchMode={searchMode}
				showResetAction={searchActive && query.trim() === activeSearchQuery}
				selectedReviewId={selectedReviewId}
				setQuery={setQuery}
				setSearchMode={setSearchMode}
				updateStatus={updateStatus}
				username={currentAuthStatus.username}
			/>
			{inboxCollapsed ? null : (
				<PaneResizeHandle
					ariaLabel="Resize review inbox"
					controls="review-inbox-pane"
					limits={inboxPane}
					onChange={setInboxWidth}
					value={inboxWidth}
				/>
			)}
			<Suspense
				fallback={
					<StatusCard title="Loading review panel" body="Preparing pull request details..." />
				}
			>
				<ReviewDetail
					colorMode={colorMode}
					currentUsername={currentUsername}
					detail={detail}
					detailError={detailError}
					detailState={detailState}
					onPullRequestDetailRefresh={onPullRequestDetailRefresh}
					review={selectedReview}
					setSummary={setSummary}
				/>
			</Suspense>
		</Grid>
	)
}
