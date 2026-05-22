import type { CacheStats, ClearCacheResult } from './cache'
import type {
	GitHubAuthStatus,
	GitHubLoginResult,
	GitHubPullRequestDetails,
	GitHubReviewRequest,
} from './github'
import type {
	GeneratedReview,
	GenerateReviewParams,
	GetSavedReviewParams,
	PublishReviewCommentParams,
	PublishReviewCommentResult,
	PublishReviewCommentsParams,
	ReviewGenerationJob,
	SubmitReviewParams,
	SubmitReviewResult,
} from './review'
import type {
	AgentAvailability,
	AppSettings,
	AvailablePiModel,
	CodeAgent,
	SaveAppSettingsParams,
} from './settings'
import type { UpdateResult, UpdateStatus } from './update'

export type AppRPCSchema = {
	main: {
		requests: {
			getAppSettings: {
				params: undefined
				response: AppSettings
			}
			saveAppSettings: {
				params: SaveAppSettingsParams
				response: AppSettings
			}
			completeOnboarding: {
				params: undefined
				response: AppSettings
			}
			listAvailablePiModels: {
				params: { agent?: CodeAgent } | undefined
				response: AvailablePiModel[]
			}
			listAgentAvailability: {
				params: undefined
				response: AgentAvailability[]
			}
			getSystemColorMode: {
				params: undefined
				response: 'dark' | 'light'
			}
			getUpdateStatus: {
				params: undefined
				response: UpdateStatus
			}
			getCacheStats: {
				params: undefined
				response: CacheStats
			}
			clearAppCache: {
				params: undefined
				response: ClearCacheResult
			}
			installUpdate: {
				params: undefined
				response: UpdateResult
			}
			getGitHubAuthStatus: {
				params: undefined
				response: GitHubAuthStatus
			}
			startGitHubLogin: {
				params: undefined
				response: GitHubLoginResult
			}
			listGitHubReviewRequests: {
				params: undefined
				response: GitHubReviewRequest[]
			}
			searchGitHubPullRequests: {
				params: { query: string; mode?: 'smart' | 'repo' | 'author' | 'title' | 'review-requested' }
				response: GitHubReviewRequest[]
			}
			getGitHubPullRequestForReview: {
				params: { query: string }
				response: GitHubReviewRequest
			}
			getGitHubPullRequestDetails: {
				params: {
					repo: string
					pullRequestNumber: number
				}
				response: GitHubPullRequestDetails
			}
			getGitHubPullRequestDiff: {
				params: {
					repo: string
					pullRequestNumber: number
					headSha: string
				}
				response: { diff: string }
			}
			getGitHubAsset: {
				params: { url: string }
				response: { dataUrl: string }
			}
			generateReview: {
				params: GenerateReviewParams
				response: GeneratedReview
			}
			startReviewGeneration: {
				params: GenerateReviewParams
				response: ReviewGenerationJob
			}
			getReviewGenerationJob: {
				params: { jobId: string }
				response: ReviewGenerationJob | null
			}
			getSavedReview: {
				params: GetSavedReviewParams
				response: GeneratedReview | null
			}
			openExternalUrl: {
				params: { url: string }
				response: { ok: true }
			}
			minimizeWindow: {
				params: undefined
				response: { ok: true }
			}
			toggleMaximizeWindow: {
				params: undefined
				response: { ok: true }
			}
			closeWindow: {
				params: undefined
				response: { ok: true }
			}
			publishReviewComment: {
				params: PublishReviewCommentParams
				response: PublishReviewCommentResult
			}
			publishReviewComments: {
				params: PublishReviewCommentsParams
				response: PublishReviewCommentResult
			}
			submitReview: {
				params: SubmitReviewParams
				response: SubmitReviewResult
			}
		}
		messages: Record<never, never>
	}
	renderer: {
		requests: Record<never, never>
		messages: {
			systemColorModeChanged: { colorMode: 'dark' | 'light' }
		}
	}
}
