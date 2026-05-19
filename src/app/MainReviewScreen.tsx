import { Grid } from 'styled-system/jsx'
import type { SearchMode } from '@/features/reviews/components/inbox/types'
import { ReviewDetail } from '@/features/reviews/components/ReviewDetail'
import { ReviewInbox } from '@/features/reviews/components/ReviewInbox'
import type {
	GitHubAuthStatus,
	GitHubPullRequestDetails,
	GitHubReviewRequest,
} from '@/shared/github'
import type { UpdateStatus } from '@/shared/update'
import type { AsyncState, ColorMode } from './types'

type MainReviewScreenProps = {
	activeSearchQuery: string
	canReviewPrQuery: boolean
	colorMode: ColorMode
	currentAuthStatus: GitHubAuthStatus
	detail: GitHubPullRequestDetails | null
	detailError: string
	detailState: AsyncState
	displayedReviews: GitHubReviewRequest[]
	loadReviewRequests: () => undefined | Promise<undefined | boolean>
	onClearSearch: () => void
	onOpenSettings: () => void
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
	detail,
	detailError,
	detailState,
	displayedReviews,
	loadReviewRequests,
	onClearSearch,
	onOpenSettings,
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
	return (
		<Grid
			gridTemplateColumns={{ base: 'minmax(0, 1fr)', lg: '24rem minmax(0, 1fr)' }}
			h="100%"
			minH="0"
			minW="0"
			overflow={{ base: 'auto', lg: 'hidden' }}
			overflowX="hidden"
		>
			<ReviewInbox
				canReviewPrQuery={canReviewPrQuery}
				onClearSearch={onClearSearch}
				onOpenSettings={onOpenSettings}
				onRefresh={loadReviewRequests}
				onReviewPr={onReviewPr}
				onSearch={onSearch}
				onSelectReview={setSelectedReviewId}
				query={query}
				reviews={displayedReviews}
				reviewPrState={reviewPrState}
				reviewsState={reviewsState}
				searchMode={searchMode}
				showResetAction={searchActive && query.trim() === activeSearchQuery}
				selectedReviewId={selectedReviewId}
				setQuery={setQuery}
				setSearchMode={setSearchMode}
				updateStatus={updateStatus}
				username={currentAuthStatus.username}
			/>
			<ReviewDetail
				colorMode={colorMode}
				detail={detail}
				detailError={detailError}
				detailState={detailState}
				review={selectedReview}
				setSummary={setSummary}
			/>
		</Grid>
	)
}
