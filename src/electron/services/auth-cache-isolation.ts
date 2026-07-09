import type { GitHubAuthStatus } from '@/shared/github'

export function shouldClearUserScopedCache(
	previous: GitHubAuthStatus | undefined,
	current: GitHubAuthStatus,
) {
	if (!previous?.authenticated) return false
	if (!current.authenticated) return true
	return previous.username !== current.username
}

export function getUserScopedPullRequestCacheKey(params: {
	owner: string
	repo: string
	pullRequestNumber: number
	headSha: string
}) {
	return `${params.owner}:${params.repo}#${params.pullRequestNumber}:${params.headSha}`
}
