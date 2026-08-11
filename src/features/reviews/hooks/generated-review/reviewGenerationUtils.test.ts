import { describe, expect, it } from 'vitest'
import type { GeneratedReview, ReviewFinding, ReviewInlineComment } from '@/shared/review'
import {
	createReviewGenerationGuard,
	getFindingCommentBody,
	getLocalReviewProgressOutput,
	getPullRequestIdentity,
	isFindingInlineComment,
	type ReviewGenerationToken,
	reviewPromptLabel,
	updateFindingComment,
} from './reviewGenerationUtils'

const finding: ReviewFinding = {
	id: 'finding-1',
	severity: 'high',
	title: 'Guard the result',
	filePath: 'src/example.ts',
	lineStart: 42,
	body: 'Long explanation',
	suggestedCommentBody: ' Add a guard here. ',
	confidence: 0.95,
}

const inlineComment: ReviewInlineComment = {
	path: 'src/example.ts',
	line: 42,
	side: 'RIGHT',
	body: 'Add a guard here.',
}

const review: GeneratedReview = {
	summary: 'Summary',
	publishableBody: 'Publishable summary',
	verdictRecommendation: 'request_changes',
	severity: 'high',
	findings: [
		finding,
		{
			...finding,
			id: 'finding-2',
			filePath: 'src/second.ts',
			lineStart: 7,
			suggestedCommentBody: 'Second comment',
		},
	],
	inlineComments: [inlineComment],
	rawOutput: 'raw',
	modelLabel: 'test-model',
	generatedAt: '2026-01-01T00:00:00.000Z',
	reviewedHeadSha: 'abc123',
	diffWasTruncated: false,
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})
	return { promise, resolve }
}

async function recordCurrentResult(
	guard: ReturnType<typeof createReviewGenerationGuard>,
	token: ReviewGenerationToken,
	result: Promise<string>,
	recorder: string[],
) {
	const value = await result
	if (guard.isCurrent(token)) recorder.push(value)
}

describe('createReviewGenerationGuard', () => {
	it('invalidates an operation when another pull request is selected', () => {
		const guard = createReviewGenerationGuard()
		const tokenA = guard.begin('owner/repo#1')

		expect(guard.isCurrent(tokenA)).toBe(true)

		guard.select('owner/repo#2')
		expect(guard.isCurrent(tokenA)).toBe(false)
		const tokenB = guard.begin('owner/repo#2')

		expect(guard.complete(tokenA)).toBe(false)
		expect(guard.isCurrent(tokenB)).toBe(true)
	})

	it('allows only the newest operation for the same pull request to complete once', () => {
		const guard = createReviewGenerationGuard()
		const firstToken = guard.begin('owner/repo#2')
		const secondToken = guard.begin('owner/repo#2')

		expect(guard.isCurrent(firstToken)).toBe(false)
		expect(guard.isCurrent(secondToken)).toBe(true)
		expect(guard.complete(secondToken)).toBe(true)
		expect(guard.complete(secondToken)).toBe(false)
	})

	it('ignores a deferred result for A after B is selected', async () => {
		const guard = createReviewGenerationGuard()
		const deferredA = createDeferred<string>()
		const deferredB = createDeferred<string>()
		const recorderA: string[] = []
		const recorderB: string[] = []
		const tokenA = guard.begin('owner/repo#1')
		const resultA = recordCurrentResult(guard, tokenA, deferredA.promise, recorderA)

		guard.select('owner/repo#2')
		const tokenB = guard.begin('owner/repo#2')
		const resultB = recordCurrentResult(guard, tokenB, deferredB.promise, recorderB)

		deferredB.resolve('B')
		await resultB
		deferredA.resolve('A')
		await resultA

		expect(recorderA).toEqual([])
		expect(recorderB).toEqual(['B'])
	})
})

describe('getLocalReviewProgressOutput', () => {
	it('formats local progress with the review prompt and transcript markers', () => {
		expect(getLocalReviewProgressOutput(['Loading the diff...', 'Starting generation...'])).toBe(
			`${reviewPromptLabel}\n\n:: Loading the diff...\n:: Starting generation...\n`,
		)
	})

	it('preserves the empty progress transcript format', () => {
		expect(getLocalReviewProgressOutput([])).toBe(`${reviewPromptLabel}\n\n\n`)
	})
})

describe('getPullRequestIdentity', () => {
	it('combines the repository and pull request number', () => {
		expect(
			getPullRequestIdentity({ repo: 'earendil/reviewer-agent', pullRequestNumber: 123 }),
		).toBe('earendil/reviewer-agent#123')
	})
})

describe('finding comment helpers', () => {
	it('uses an explicit empty comment instead of falling back to the explanation body', () => {
		expect(getFindingCommentBody({ ...finding, suggestedCommentBody: '' })).toBe('')
		expect(getFindingCommentBody({ ...finding, suggestedCommentBody: undefined })).toBe(
			finding.body,
		)
	})

	it('immutably updates one finding and preserves exact whitespace', () => {
		const commentBody = '  Keep this whitespace.  \n'
		const updated = updateFindingComment(review, finding.id, commentBody)

		expect(updated).not.toBe(review)
		expect(updated.findings).not.toBe(review.findings)
		expect(updated.findings[0]).not.toBe(review.findings[0])
		expect(updated.findings[0]?.suggestedCommentBody).toBe(commentBody)
		expect(updated.findings[1]).toBe(review.findings[1])
		expect(review.findings[0]?.suggestedCommentBody).toBe(' Add a guard here. ')
	})

	it('preserves an explicit empty edit', () => {
		const updated = updateFindingComment(review, finding.id, '')

		expect(updated.findings[0]?.suggestedCommentBody).toBe('')
		expect(getFindingCommentBody(updated.findings[0] as ReviewFinding)).toBe('')
	})

	it('returns the original review for an unknown finding ID or unchanged comment', () => {
		expect(updateFindingComment(review, 'unknown', 'Comment')).toBe(review)
		expect(updateFindingComment(review, finding.id, finding.suggestedCommentBody ?? '')).toBe(
			review,
		)
	})

	it('keeps independent edits to two findings', () => {
		const firstUpdate = updateFindingComment(review, 'finding-1', 'First edit')
		const secondUpdate = updateFindingComment(firstUpdate, 'finding-2', 'Second edit')

		expect(secondUpdate.findings.map(getFindingCommentBody)).toEqual(['First edit', 'Second edit'])
		expect(firstUpdate.findings[1]?.suggestedCommentBody).toBe('Second comment')
	})
})

describe('isFindingInlineComment', () => {
	it('matches the exact path, right-side line, and trimmed suggested body', () => {
		expect(isFindingInlineComment(finding, inlineComment)).toBe(true)
		expect(
			isFindingInlineComment(finding, { ...inlineComment, body: '  Add a guard here.  ' }),
		).toBe(true)
	})

	it('rejects comments that differ by path, side, line, or body', () => {
		expect(isFindingInlineComment(finding, { ...inlineComment, path: 'src/other.ts' })).toBe(false)
		expect(isFindingInlineComment(finding, { ...inlineComment, side: 'LEFT' })).toBe(false)
		expect(isFindingInlineComment(finding, { ...inlineComment, line: 43 })).toBe(false)
		expect(isFindingInlineComment(finding, { ...inlineComment, body: 'Long explanation' })).toBe(
			false,
		)
	})

	it('falls back to the finding body when no suggested body is present', () => {
		const findingWithoutSuggestion = { ...finding, suggestedCommentBody: undefined }
		expect(
			isFindingInlineComment(findingWithoutSuggestion, {
				...inlineComment,
				body: ' Long explanation ',
			}),
		).toBe(true)
	})

	it('does not match an explicitly empty comment edit', () => {
		expect(isFindingInlineComment({ ...finding, suggestedCommentBody: '' }, inlineComment)).toBe(
			false,
		)
	})
})
