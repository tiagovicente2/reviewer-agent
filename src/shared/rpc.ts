import type {
	GitHubAuthStatus,
	GitHubLoginResult,
	GitHubPullRequestDetails,
	GitHubReviewRequest,
} from './github'
import type {
	GeneratePiReviewParams,
	GetSavedPiReviewParams,
	PiGeneratedReview,
	PiReviewGenerationJob,
	PublishPiReviewCommentParams,
	PublishPiReviewCommentResult,
	PublishPiReviewCommentsParams,
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
			generateReviewWithPi: {
				params: GeneratePiReviewParams
				response: PiGeneratedReview
			}
			startPiReviewGeneration: {
				params: GeneratePiReviewParams
				response: PiReviewGenerationJob
			}
			getPiReviewGenerationJob: {
				params: { jobId: string }
				response: PiReviewGenerationJob | null
			}
			getSavedPiReview: {
				params: GetSavedPiReviewParams
				response: PiGeneratedReview | null
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
			publishPiReviewComment: {
				params: PublishPiReviewCommentParams
				response: PublishPiReviewCommentResult
			}
			publishPiReviewComments: {
				params: PublishPiReviewCommentsParams
				response: PublishPiReviewCommentResult
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
