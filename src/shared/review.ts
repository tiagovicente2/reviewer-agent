import type { GitHubPullRequestDetails } from './github'

export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type ReviewFinding = {
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

export type ReviewInlineComment = {
	path: string
	line: number
	side: 'RIGHT' | 'LEFT'
	body: string
	author?: string
	createdAt?: string
}

export type GeneratedReview = {
	summary: string
	publishableBody: string
	verdictRecommendation: 'comment' | 'approve' | 'request_changes'
	severity: ReviewSeverity
	findings: ReviewFinding[]
	inlineComments: ReviewInlineComment[]
	rawOutput: string
	modelLabel: string
	generatedAt: string
	diffWasTruncated: boolean
}

export type GenerateReviewParams = {
	pullRequest: GitHubPullRequestDetails
}

export function getReviewGenerationPullRequestKey(pullRequest: {
	repo: string
	pullRequestNumber: number
	headSha: string
}) {
	return `${pullRequest.repo}#${pullRequest.pullRequestNumber}:${pullRequest.headSha}`
}

export function getReviewGenerationJobId(pullRequest: {
	repo: string
	pullRequestNumber: number
	headSha: string
}) {
	return `review-generation:${getReviewGenerationPullRequestKey(pullRequest)}`
}

export type ReviewGenerationJob = {
	id: string
	pullRequestKey: string
	status: 'running' | 'completed' | 'failed'
	outputText?: string
	statusMessage?: string
	startedAt: string
	finishedAt?: string
	review?: GeneratedReview
	error?: string
}

export type GetSavedReviewParams = {
	repo: string
	pullRequestNumber: number
	headSha: string
}

export type PublishReviewCommentParams = {
	pullRequest: GitHubPullRequestDetails
	finding: ReviewFinding
}

export type PublishReviewCommentsParams = {
	pullRequest: GitHubPullRequestDetails
	findings: ReviewFinding[]
}

export type ReviewSubmitEvent = 'approve' | 'request_changes'

export type SubmitReviewParams = {
	pullRequest: GitHubPullRequestDetails
	event: ReviewSubmitEvent
	body?: string
	findings?: ReviewFinding[]
}

export type PublishReviewCommentResult = {
	ok: true
	output: string
}

export type SubmitReviewResult = PublishReviewCommentResult
