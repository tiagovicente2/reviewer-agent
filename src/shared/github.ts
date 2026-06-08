export type GitHubAuthStatus = {
	ghInstalled: boolean
	authenticated: boolean
	username?: string
	message?: string
	error?: string
}

export type GitHubLoginResult = {
	ok: boolean
	status: GitHubAuthStatus
	output: string
}

export type GitHubReviewRequest = {
	id: string
	repo: string
	pullRequestNumber: number
	title: string
	author: string
	url: string
	updatedAt: string
	state: string
	isDraft: boolean
	notificationReason?: string
	unread?: boolean
}

export type GitHubPullRequestReview = {
	author: string
	state: string
	submittedAt?: string
}

export type GitHubPullRequestDetails = {
	repo: string
	pullRequestNumber: number
	title: string
	author: string
	url: string
	body: string
	state: string
	isDraft: boolean
	headSha: string
	headRefName: string
	baseRefName: string
	changedFilesCount: number
	additions: number
	deletions: number
	reviewDecision?: string
	reviews: GitHubPullRequestReview[]
	files: Array<{
		path: string
		additions: number
		deletions: number
	}>
	diff: string
}
