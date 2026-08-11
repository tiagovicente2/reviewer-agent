import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { ReviewFinding } from '@/shared/review'
import { runCommand } from '../process'
import { getGitHubPullRequestDetails } from './github'
import { publishReviewComments, submitReview } from './review-publish'

vi.mock('../process', () => ({
	runCommand: vi.fn(),
}))

vi.mock('./github', () => ({
	getGitHubPullRequestDetails: vi.fn(),
}))

const mockedRunCommand = vi.mocked(runCommand)
const mockedGetGitHubPullRequestDetails = vi.mocked(getGitHubPullRequestDetails)

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

function withExistingComment(value: ReviewFinding): GitHubPullRequestDetails {
	return {
		...pullRequest,
		reviewThreads: [
			{
				comments: [{ author: 'reviewer', body: `  ${value.body.toUpperCase()}  ` }],
				id: `thread-${value.id}`,
				isOutdated: false,
				isResolved: false,
				line: value.lineStart,
				path: value.filePath,
			},
		],
	}
}

describe('review publication', () => {
	beforeEach(() => {
		mockedRunCommand.mockReset()
		mockedGetGitHubPullRequestDetails.mockReset()
		mockedGetGitHubPullRequestDetails.mockResolvedValue(pullRequest)
	})

	it('preserves partial publication successes and reports failures by finding', async () => {
		mockedRunCommand
			.mockResolvedValueOnce({ exitCode: 1, stderr: 'first failed', stdout: '' })
			.mockResolvedValueOnce({ exitCode: 0, stderr: '', stdout: 'published' })

		const result = await publishReviewComments({
			findings: [finding('first', 'src/first.ts'), finding('second', 'src/second.ts')],
			pullRequest,
			reviewedHeadSha: 'head-sha',
		})

		expect(result).toEqual({
			alreadyPublishedFindingIds: [],
			failures: [{ findingId: 'first', message: 'first failed' }],
			ok: false,
			output: 'Published comment for src/second.ts:1\nfirst failed',
			publishedFindingIds: ['second'],
		})
		expect(mockedRunCommand).toHaveBeenCalledTimes(2)
	})

	it('uses fresh threads and treats a stale renderer snapshot as idempotent success', async () => {
		const existing = finding('first', 'src/first.ts')
		mockedGetGitHubPullRequestDetails.mockResolvedValue(withExistingComment(existing))

		const result = await publishReviewComments({
			findings: [existing],
			pullRequest,
			reviewedHeadSha: 'head-sha',
		})

		expect(result.alreadyPublishedFindingIds).toEqual(['first'])
		expect(result.publishedFindingIds).toEqual([])
		expect(result.ok).toBe(true)
		expect(mockedRunCommand).not.toHaveBeenCalled()
		expect(mockedGetGitHubPullRequestDetails).toHaveBeenCalledWith({
			forceRefresh: true,
			pullRequestNumber: 7,
			repo: 'owner/repo',
		})
	})

	it('serializes same-PR operations so the second fresh read prevents duplication', async () => {
		const firstFinding = finding('first', 'src/first.ts')
		let latestDetail = pullRequest
		mockedGetGitHubPullRequestDetails.mockImplementation(async () => latestDetail)
		mockedRunCommand.mockImplementationOnce(async () => {
			latestDetail = withExistingComment(firstFinding)
			return { exitCode: 0, stderr: '', stdout: 'published' }
		})

		const first = publishReviewComments({
			findings: [firstFinding],
			pullRequest,
			reviewedHeadSha: 'head-sha',
		})
		const second = publishReviewComments({
			findings: [firstFinding],
			pullRequest,
			reviewedHeadSha: 'head-sha',
		})

		const [firstResult, secondResult] = await Promise.all([first, second])
		expect(firstResult.publishedFindingIds).toEqual(['first'])
		expect(secondResult.alreadyPublishedFindingIds).toEqual(['first'])
		expect(mockedRunCommand).toHaveBeenCalledTimes(1)
		expect(mockedGetGitHubPullRequestDetails).toHaveBeenCalledTimes(2)
	})

	it('omits existing request-change comments while retaining new comments and body', async () => {
		const existing = finding('first', 'src/first.ts')
		const next = finding('second', 'src/second.ts')
		mockedGetGitHubPullRequestDetails.mockResolvedValue(withExistingComment(existing))
		mockedRunCommand.mockResolvedValue({ exitCode: 0, stderr: '', stdout: 'submitted' })

		const result = await submitReview({
			body: 'Please address these issues.',
			event: 'request_changes',
			findings: [existing, next],
			pullRequest,
			reviewedHeadSha: 'head-sha',
		})

		expect(result.publishedFindingIds).toEqual(['second'])
		expect(result.alreadyPublishedFindingIds).toEqual(['first'])
		const options = mockedRunCommand.mock.calls[0]?.[2]
		expect(JSON.parse(String(options?.input))).toEqual({
			body: 'Please address these issues.',
			comments: [
				{
					body: 'Comment second',
					line: 1,
					path: 'src/second.ts',
					side: 'RIGHT',
				},
			],
			commit_id: 'head-sha',
			event: 'REQUEST_CHANGES',
		})
	})

	it('submits a body-only change request when every inline comment already exists', async () => {
		const existing = finding('first', 'src/first.ts')
		mockedGetGitHubPullRequestDetails.mockResolvedValue(withExistingComment(existing))
		mockedRunCommand.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' })

		const result = await submitReview({
			body: 'Please address this.',
			event: 'request_changes',
			findings: [existing],
			pullRequest,
			reviewedHeadSha: 'head-sha',
		})

		expect(result.alreadyPublishedFindingIds).toEqual(['first'])
		const options = mockedRunCommand.mock.calls[0]?.[2]
		expect(JSON.parse(String(options?.input))).toEqual({
			body: 'Please address this.',
			comments: [],
			event: 'REQUEST_CHANGES',
		})
	})
})
