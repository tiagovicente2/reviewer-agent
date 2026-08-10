import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { ReviewFinding } from '@/shared/review'
import { runCommand } from '../process'
import { publishReviewComments } from './review-publish'

vi.mock('../process', () => ({
	runCommand: vi.fn(),
}))

const mockedRunCommand = vi.mocked(runCommand)

const pullRequest: GitHubPullRequestDetails = {
	additions: 2,
	author: 'reviewer',
	baseRefName: 'main',
	body: '',
	changedFilesCount: 2,
	deletions: 0,
	diff: '',
	headRefName: 'feature',
	repo: 'owner/repo',
	pullRequestNumber: 7,
	headSha: 'head-sha',
	isDraft: false,
	reviews: [],
	reviewRequests: [],
	state: 'OPEN',
	title: 'Test pull request',
	url: 'https://github.com/owner/repo/pull/7',
	files: [
		{ path: 'src/first.ts', additions: 1, deletions: 0 },
		{ path: 'src/second.ts', additions: 1, deletions: 0 },
	],
	reviewThreads: [],
}

function finding(id: string, filePath: string): ReviewFinding {
	return {
		body: `Comment ${id}`,
		confidence: 1,
		filePath,
		id,
		lineStart: 1,
		severity: 'medium',
		title: `Finding ${id}`,
	}
}

describe('publishReviewComments', () => {
	beforeEach(() => {
		mockedRunCommand.mockReset()
	})

	it('waits for every publication and reports successes with all failures', async () => {
		mockedRunCommand
			.mockResolvedValueOnce({ exitCode: 0, stderr: '', stdout: 'head-sha\n' })
			.mockResolvedValueOnce({ exitCode: 1, stderr: 'first failed', stdout: '' })
			.mockResolvedValueOnce({ exitCode: 0, stderr: '', stdout: 'published' })

		await expect(
			publishReviewComments({
				findings: [finding('first', 'src/first.ts'), finding('second', 'src/second.ts')],
				pullRequest,
				reviewedHeadSha: 'head-sha',
			}),
		).rejects.toThrow('Published comment for src/second.ts:1\nfirst failed')

		expect(mockedRunCommand).toHaveBeenCalledTimes(3)
	})
})
