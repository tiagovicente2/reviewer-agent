import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCommand } from '../process'
import { getGitHubPullRequestDiff } from './github'

vi.mock('../paths', () => ({
	getHomePath: () => '/tmp',
}))

vi.mock('../process', () => ({
	runCommand: vi.fn(),
	runCommandBuffer: vi.fn(),
}))

vi.mock('./pull-request-cache', () => ({
	getCachedPullRequestDetails: vi.fn(),
	getCachedPullRequestDiff: vi.fn(() => null),
	saveCachedPullRequestDetails: vi.fn(),
	saveCachedPullRequestDiff: vi.fn(),
}))

const mockedRunCommand = vi.mocked(runCommand)

describe('getGitHubPullRequestDiff', () => {
	beforeEach(() => {
		mockedRunCommand.mockReset()
	})

	it('requests the aggregate pull request diff without patch mode', async () => {
		mockedRunCommand.mockResolvedValue({ exitCode: 0, stderr: '', stdout: 'aggregate diff' })

		await expect(
			getGitHubPullRequestDiff({
				forceRefresh: true,
				headSha: 'head-sha',
				pullRequestNumber: 7,
				repo: 'owner/repo',
			}),
		).resolves.toEqual({ diff: 'aggregate diff' })

		const args = mockedRunCommand.mock.calls[0]?.[1]
		expect(args).toEqual(['pr', 'diff', '7', '--repo', 'owner/repo', '--color=never'])
		expect(args).not.toContain('--patch')
	})
})
