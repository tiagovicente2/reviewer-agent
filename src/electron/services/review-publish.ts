import type { GitHubPullRequestDetails } from '@/shared/github'
import type {
	PublishReviewCommentParams,
	PublishReviewCommentResult,
	PublishReviewCommentsParams,
	ReviewFinding,
	ReviewFindingPublicationFailure,
	ReviewSubmitEvent,
	SubmitReviewParams,
	SubmitReviewResult,
} from '@/shared/review'
import {
	getFindingCommentBody,
	getReviewCommentKey,
	isPublishableFinding,
	partitionFindingsByReviewThreads,
} from '@/shared/review-publication'
import { getReviewSubmissionPolicy } from '@/shared/review-submission'
import { runCommand } from '../process'
import { getGitHubAuthStatus, getGitHubPullRequestDetails } from './github'

const GH_PUBLISH_TIMEOUT_MS = 60 * 1000
const publicationQueues = new Map<string, Promise<unknown>>()
const reviewSubmissionLocks = new Set<string>()
const completedReviewSubmissions = new Map<string, ReviewSubmitEvent>()

type CommandResult = {
	exitCode: number
	stdout: string
	stderr: string
}

type FindingGroup = {
	finding: ReviewFinding
	findingIds: string[]
}

export function publishReviewComment(
	params: PublishReviewCommentParams,
): Promise<PublishReviewCommentResult> {
	return publishReviewComments({
		findings: [params.finding],
		pullRequest: params.pullRequest,
		reviewedHeadSha: params.reviewedHeadSha,
	})
}

export function publishReviewComments(
	params: PublishReviewCommentsParams,
): Promise<PublishReviewCommentResult> {
	return serializePublication(getPublicationKey(params.pullRequest), async () => {
		const latestPullRequest = await getLatestPullRequest(params.pullRequest)
		assertReviewTargetsHead(params.reviewedHeadSha, latestPullRequest.headSha)

		const markedPublishedIds = getMarkedPublishedFindingIds(params.findings)
		const groups = groupPublishableFindings(params.findings)
		const { alreadyPublishedFindings, newFindings } = partitionFindingsByReviewThreads(
			groups.map((group) => group.finding),
			latestPullRequest.reviewThreads,
		)
		const groupsByFinding = new Map(groups.map((group) => [group.finding, group]))
		const alreadyPublishedFindingIds = [
			...markedPublishedIds,
			...alreadyPublishedFindings.flatMap(
				(finding) => groupsByFinding.get(finding)?.findingIds ?? [finding.id],
			),
		]

		const failures = getUnpublishableFindingFailures(params.findings)
		if (newFindings.length === 0) {
			return {
				ok: failures.length === 0,
				output:
					failures.length > 0
						? failures.map((failure) => failure.message).join('\n')
						: 'All requested inline comments are already published.',
				publishedFindingIds: [],
				alreadyPublishedFindingIds,
				failures,
			}
		}

		const settlements = await Promise.allSettled(
			newFindings.map(async (finding) => {
				validatePublishableFinding(latestPullRequest, finding)
				const result = await publishFinding(params, finding, latestPullRequest.headSha)
				const output = commandOutput(result)
				if (result.exitCode !== 0) {
					throw new Error(
						output || `Failed to publish comment for ${finding.filePath}:${finding.lineStart}.`,
					)
				}
				return `Published comment for ${finding.filePath}:${finding.lineStart}`
			}),
		)

		const outputs: string[] = []
		const publishedFindingIds: string[] = []
		for (const [index, settlement] of settlements.entries()) {
			const finding = newFindings[index]
			if (!finding) continue
			const findingIds = groupsByFinding.get(finding)?.findingIds ?? [finding.id]
			if (settlement.status === 'fulfilled') {
				outputs.push(settlement.value)
				publishedFindingIds.push(...findingIds)
			} else {
				const message = getErrorMessage(settlement.reason)
				for (const findingId of findingIds) failures.push({ findingId, message })
			}
		}

		return {
			ok: failures.length === 0,
			output: [...outputs, ...failures.map((failure) => failure.message)].join('\n'),
			publishedFindingIds,
			alreadyPublishedFindingIds,
			failures,
		}
	})
}

export async function submitReview(params: SubmitReviewParams): Promise<SubmitReviewResult> {
	const key = getPublicationKey(params.pullRequest)
	if (reviewSubmissionLocks.has(key)) throw new Error('A review is already being submitted.')
	if (completedReviewSubmissions.has(key)) {
		throw new Error('A final review was already submitted for this pull request.')
	}

	reviewSubmissionLocks.add(key)
	try {
		return await serializePublication(key, async () => {
			const body = params.body?.trim()
			const [authStatus, latestPullRequest] = await Promise.all([
				getGitHubAuthStatus(),
				getLatestPullRequest(params.pullRequest),
			])
			assertReviewTargetsHead(params.reviewedHeadSha, latestPullRequest.headSha)

			const markedPublishedIds = getMarkedPublishedFindingIds(params.findings ?? [])
			const groups = groupPublishableFindings(params.findings ?? [])
			const { alreadyPublishedFindings, newFindings } = partitionFindingsByReviewThreads(
				groups.map((group) => group.finding),
				latestPullRequest.reviewThreads,
			)
			const policy = getReviewSubmissionPolicy({
				currentUsername: authStatus.authenticated ? authStatus.username : undefined,
				detail: latestPullRequest,
				event: params.event,
				hasReviewBody: Boolean(body),
				publishableFindingsCount: newFindings.length,
				reviewedHeadSha: params.reviewedHeadSha,
				submissionLocked: false,
				submittedEvent: completedReviewSubmissions.get(key) ?? null,
			})
			if (!policy.allowed) throw new Error(policy.reason)

			const result =
				params.event === 'approve'
					? await submitApproval(params, body)
					: await submitChangeRequest({
							body,
							groups,
							latestPullRequest,
							markedPublishedIds,
							newFindings,
							alreadyPublishedFindings,
							params,
						})
			completedReviewSubmissions.set(key, params.event)
			return result
		})
	} finally {
		reviewSubmissionLocks.delete(key)
	}
}

async function submitChangeRequest({
	body,
	groups,
	latestPullRequest,
	markedPublishedIds,
	newFindings,
	alreadyPublishedFindings,
	params,
}: {
	body: string | undefined
	groups: FindingGroup[]
	latestPullRequest: GitHubPullRequestDetails
	markedPublishedIds: string[]
	newFindings: ReviewFinding[]
	alreadyPublishedFindings: ReviewFinding[]
	params: SubmitReviewParams
}): Promise<SubmitReviewResult> {
	const groupsByFinding = new Map(groups.map((group) => [group.finding, group]))
	const alreadyPublishedFindingIds = [
		...markedPublishedIds,
		...alreadyPublishedFindings.flatMap(
			(finding) => groupsByFinding.get(finding)?.findingIds ?? [finding.id],
		),
	]
	validatePublishableFindings(latestPullRequest, newFindings)

	const comments = newFindings.map((finding) => ({
		body: getFindingCommentBody(finding).trim(),
		line: finding.lineStart,
		path: finding.filePath,
		side: 'RIGHT' as const,
	}))
	const payload: {
		body?: string
		comments: typeof comments
		commit_id?: string
		event: 'REQUEST_CHANGES'
	} = { comments, event: 'REQUEST_CHANGES' }
	if (body) payload.body = body
	if (comments.length > 0) payload.commit_id = latestPullRequest.headSha

	const result = await runGh(
		[
			'api',
			'--method',
			'POST',
			`repos/${params.pullRequest.repo}/pulls/${params.pullRequest.pullRequestNumber}/reviews`,
			'--input',
			'-',
		],
		JSON.stringify(payload),
	)
	const output = commandOutput(result)
	if (result.exitCode !== 0) throw new Error(output || 'Failed to submit pull request review.')

	return {
		ok: true,
		output: output || 'Submitted change request.',
		publishedFindingIds: newFindings.flatMap(
			(finding) => groupsByFinding.get(finding)?.findingIds ?? [finding.id],
		),
		alreadyPublishedFindingIds,
	}
}

async function submitApproval(
	params: SubmitReviewParams,
	body: string | undefined,
): Promise<SubmitReviewResult> {
	const args = [
		'pr',
		'review',
		String(params.pullRequest.pullRequestNumber),
		'--repo',
		params.pullRequest.repo,
		'--approve',
	]
	if (body) args.push('--body', body)

	const result = await runGh(args)
	const output = commandOutput(result)
	if (result.exitCode !== 0) throw new Error(output || 'Failed to approve pull request.')

	return {
		ok: true,
		output: output || 'Submitted approval.',
		publishedFindingIds: [],
		alreadyPublishedFindingIds: [],
	}
}

function serializePublication<T>(key: string, work: () => Promise<T>): Promise<T> {
	const previous = publicationQueues.get(key) ?? Promise.resolve()
	const next = previous.catch(() => undefined).then(work)
	publicationQueues.set(key, next)
	return next.finally(() => {
		if (publicationQueues.get(key) === next) publicationQueues.delete(key)
	})
}

function getPublicationKey(
	pullRequest: Pick<GitHubPullRequestDetails, 'pullRequestNumber' | 'repo'>,
) {
	return `${pullRequest.repo}#${pullRequest.pullRequestNumber}`
}

async function getLatestPullRequest(
	pullRequest: Pick<GitHubPullRequestDetails, 'pullRequestNumber' | 'repo'>,
) {
	return getGitHubPullRequestDetails({
		forceRefresh: true,
		pullRequestNumber: pullRequest.pullRequestNumber,
		repo: pullRequest.repo,
	})
}

function assertReviewTargetsHead(reviewedHeadSha: string, latestHeadSha: string) {
	if (reviewedHeadSha && latestHeadSha && latestHeadSha !== reviewedHeadSha) {
		throw new Error(
			`This draft review was generated for ${reviewedHeadSha.slice(0, 12)}, but the PR is now at ${latestHeadSha.slice(0, 12)}. Regenerate the review before publishing.`,
		)
	}
}

function validatePublishableFindings(
	pullRequest: GitHubPullRequestDetails,
	findings: ReviewFinding[],
) {
	for (const finding of findings) validatePublishableFinding(pullRequest, finding)
}

function validatePublishableFinding(pullRequest: GitHubPullRequestDetails, finding: ReviewFinding) {
	if (!pullRequest.files.some((file) => file.path === finding.filePath)) {
		throw new Error(`Cannot publish comment for unchanged file: ${finding.filePath}.`)
	}
	if (!Number.isInteger(finding.lineStart) || !finding.lineStart || finding.lineStart < 1) {
		throw new Error(`Cannot publish comment with invalid line for ${finding.filePath}.`)
	}
}

function getUnpublishableFindingFailures(findings: ReviewFinding[]) {
	const failures: ReviewFindingPublicationFailure[] = []
	for (const finding of findings) {
		if (finding.publication?.state === 'published' || isPublishableFinding(finding)) continue
		failures.push({
			findingId: finding.id,
			message: `Finding ${finding.id} is missing a file path, line number, or comment body.`,
		})
	}
	return failures
}

function getMarkedPublishedFindingIds(findings: ReviewFinding[]) {
	const findingIds: string[] = []
	for (const finding of findings) {
		if (finding.publication?.state === 'published') findingIds.push(finding.id)
	}
	return findingIds
}

function groupPublishableFindings(findings: ReviewFinding[]): FindingGroup[] {
	const groups = new Map<string, FindingGroup>()
	for (const finding of findings) {
		if (!isPublishableFinding(finding)) continue
		const key = getReviewCommentKey({
			body: getFindingCommentBody(finding),
			line: finding.lineStart,
			path: finding.filePath,
		})
		const existing = groups.get(key)
		if (existing) existing.findingIds.push(finding.id)
		else groups.set(key, { finding, findingIds: [finding.id] })
	}
	return [...groups.values()]
}

function commandOutput(result: CommandResult) {
	return [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error)
}

async function publishFinding(
	params: PublishReviewCommentsParams,
	finding: ReviewFinding,
	commitId: string,
): Promise<CommandResult> {
	const body = getFindingCommentBody(finding).trim()
	if (!body || !finding.lineStart)
		throw new Error('Finding is missing a comment body or line number.')

	return runGh([
		'api',
		`repos/${params.pullRequest.repo}/pulls/${params.pullRequest.pullRequestNumber}/comments`,
		'-f',
		`body=${body}`,
		'-f',
		`commit_id=${commitId}`,
		'-f',
		`path=${finding.filePath}`,
		'-F',
		`line=${finding.lineStart}`,
		'-f',
		'side=RIGHT',
	])
}

async function runGh(args: string[], input?: string): Promise<CommandResult> {
	return runCommand('gh', args, {
		env: process.env,
		input,
		timeoutMs: GH_PUBLISH_TIMEOUT_MS,
	})
}
