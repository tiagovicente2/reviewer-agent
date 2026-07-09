import { describe, expect, it } from 'vitest'
import type { GitHubAuthStatus } from '@/shared/github'
import {
	getUserScopedPullRequestCacheKey,
	shouldClearUserScopedCache,
} from './auth-cache-isolation'

const signedIn = (username: string): GitHubAuthStatus => ({
	ghInstalled: true,
	authenticated: true,
	username,
})

const signedOut: GitHubAuthStatus = {
	ghInstalled: true,
	authenticated: false,
}

describe('GitHub user-scoped cache isolation', () => {
	it('includes the authenticated user in pull request cache keys', () => {
		const params = { repo: 'octo/repo', pullRequestNumber: 42, headSha: 'abc123' }

		expect(getUserScopedPullRequestCacheKey({ ...params, owner: 'account-a' })).not.toBe(
			getUserScopedPullRequestCacheKey({ ...params, owner: 'account-b' }),
		)
	})

	it('clears user-scoped cache on sign-out', () => {
		expect(shouldClearUserScopedCache(signedIn('account-a'), signedOut)).toBe(true)
	})

	it('clears user-scoped cache when the authenticated user changes', () => {
		expect(shouldClearUserScopedCache(signedIn('account-a'), signedIn('account-b'))).toBe(true)
	})

	it('keeps user-scoped cache for the same authenticated user', () => {
		expect(shouldClearUserScopedCache(signedIn('account-a'), signedIn('account-a'))).toBe(false)
	})
})
