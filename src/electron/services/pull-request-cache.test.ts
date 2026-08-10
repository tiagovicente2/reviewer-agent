import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../paths', () => ({
	getUserDataPath: () => {
		const path = process.env.REVIEWER_AGENT_PULL_REQUEST_CACHE_TEST_PATH
		if (!path) throw new Error('Missing pull request cache test path.')
		return path
	},
}))

let cacheRoot: string | undefined

afterEach(() => {
	vi.resetModules()
	delete process.env.REVIEWER_AGENT_PULL_REQUEST_CACHE_TEST_PATH
	if (cacheRoot) rmSync(cacheRoot, { force: true, recursive: true })
	cacheRoot = undefined
})

describe('pull request diff cache versioning', () => {
	it('uses the version 2 aggregate diff instead of an unversioned legacy diff', async () => {
		cacheRoot = mkdtempSync(join(tmpdir(), 'reviewer-agent-pull-request-cache-'))
		process.env.REVIEWER_AGENT_PULL_REQUEST_CACHE_TEST_PATH = cacheRoot
		const cachePath = join(cacheRoot, 'pull-request-cache.json')
		mkdirSync(cacheRoot, { recursive: true })
		writeFileSync(
			cachePath,
			JSON.stringify({
				details: {},
				diffs: {
					'owner/repo#7:head-sha': {
						createdAt: '2026-01-01T00:00:00.000Z',
						diff: 'legacy patch diff',
						headSha: 'head-sha',
						pullRequestNumber: 7,
						repo: 'owner/repo',
						updatedAt: '2026-01-01T00:00:00.000Z',
					},
					'owner/repo#7:head-sha:diff-v2': {
						createdAt: '2026-01-02T00:00:00.000Z',
						diff: 'aggregate diff',
						headSha: 'head-sha',
						pullRequestNumber: 7,
						repo: 'owner/repo',
						updatedAt: '2026-01-02T00:00:00.000Z',
					},
				},
			}),
		)

		const { getCachedPullRequestDiff } = await import('./pull-request-cache')

		expect(
			getCachedPullRequestDiff({
				headSha: 'head-sha',
				pullRequestNumber: 7,
				repo: 'owner/repo',
			}),
		).toBe('aggregate diff')
	})

	it('ignores an unversioned legacy diff when no aggregate diff is cached', async () => {
		cacheRoot = mkdtempSync(join(tmpdir(), 'reviewer-agent-pull-request-cache-'))
		process.env.REVIEWER_AGENT_PULL_REQUEST_CACHE_TEST_PATH = cacheRoot
		writeFileSync(
			join(cacheRoot, 'pull-request-cache.json'),
			JSON.stringify({
				details: {},
				diffs: {
					'owner/repo#7:head-sha': {
						createdAt: '2026-01-01T00:00:00.000Z',
						diff: 'legacy patch diff',
						headSha: 'head-sha',
						pullRequestNumber: 7,
						repo: 'owner/repo',
						updatedAt: '2026-01-01T00:00:00.000Z',
					},
				},
			}),
		)

		const { getCachedPullRequestDiff } = await import('./pull-request-cache')

		expect(
			getCachedPullRequestDiff({
				headSha: 'head-sha',
				pullRequestNumber: 7,
				repo: 'owner/repo',
			}),
		).toBeNull()
	})
})
