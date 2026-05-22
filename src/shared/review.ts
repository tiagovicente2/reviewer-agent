import type { GitHubPullRequestDetails } from './github'

export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type PiReviewFinding = {
	id: string
	severity: ReviewSeverity
	title: string
	filePath: string
	lineStart?: number
	lineEnd?: number
	codeSnippet?: string
	body: string
	suggestedCommentBody?: string
	fixSuggestion?: string
	confidence: number
}

export type PiInlineComment = {
	path: string
	line: number
	side: 'RIGHT' | 'LEFT'
	body: string
	author?: string
	createdAt?: string
}

export type PiGeneratedReview = {
	summary: string
	publishableBody: string
	verdictRecommendation: 'comment' | 'approve' | 'request_changes'
	severity: ReviewSeverity
	findings: PiReviewFinding[]
	inlineComments: PiInlineComment[]
	rawOutput: string
	modelLabel: string
	generatedAt: string
	diffWasTruncated: boolean
}

export type GeneratePiReviewParams = {
	pullRequest: GitHubPullRequestDetails
}

export type PiReviewGenerationJob = {
	id: string
	pullRequestKey: string
	status: 'running' | 'completed' | 'failed'
	statusMessage?: string
	startedAt: string
	finishedAt?: string
	review?: PiGeneratedReview
	error?: string
}

export type GetSavedPiReviewParams = {
	repo: string
	pullRequestNumber: number
	headSha: string
}

export type PublishPiReviewCommentParams = {
	pullRequest: GitHubPullRequestDetails
	finding: PiReviewFinding
}

export type PublishPiReviewCommentsParams = {
	pullRequest: GitHubPullRequestDetails
	findings: PiReviewFinding[]
}

export type PiReviewSubmitEvent = 'approve' | 'request_changes'

export type SubmitPiReviewParams = {
	pullRequest: GitHubPullRequestDetails
	event: PiReviewSubmitEvent
	body?: string
	findings?: PiReviewFinding[]
}

export type PublishPiReviewCommentResult = {
	ok: true
	output: string
}

export type SubmitPiReviewResult = PublishPiReviewCommentResult
