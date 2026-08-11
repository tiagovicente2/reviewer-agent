import { getFindingCommentBody } from '@/features/reviews/hooks/generated-review/reviewGenerationUtils'
import type {
	PublishReviewCommentParams,
	PublishReviewCommentResult,
	PublishReviewCommentsParams,
	ReviewFinding,
	SubmitReviewParams,
	SubmitReviewResult,
} from '@/shared/review'
import { runCommand } from '../process'

const GH_PUBLISH_TIMEOUT_MS = 60 * 1000

type CommandResult = {
	exitCode: number
	stdout: string
	stderr: string
}

export async function publishReviewComment(
	params: PublishReviewCommentParams,
): Promise<PublishReviewCommentResult> {
	return publishReviewComments({
		findings: [params.finding],
		pullRequest: params.pullRequest,
		reviewedHeadSha: params.reviewedHeadSha,
	})
}

export async function publishReviewComments(
	params: PublishReviewCommentsParams,
): Promise<PublishReviewCommentResult> {
	const latestHeadSha = await assertReviewTargetsLatestHead(params)
	const publishableFindings = filterNewFindings(
		params.pullRequest,
		dedupeFindings(params.findings.filter(isPublishableFinding)),
	)
	validatePublishableFindings(params, publishableFindings)
	if (publishableFindings.length === 0) {
		throw new Error(
			'No new publishable inline findings. Findings need filePath, lineStart, and a comment body that is not already present on the PR.',
		)
	}

	const settlements = await Promise.allSettled(
		publishableFindings.map(async (finding) => {
			const result = await publishFinding(params, finding, latestHeadSha)
			const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

			if (result.exitCode !== 0) {
				throw new Error(
					output || `Failed to publish comment for ${finding.filePath}:${finding.lineStart}.`,
				)
			}

			return `Published comment for ${finding.filePath}:${finding.lineStart}`
		}),
	)
	const results: string[] = []
	const failures: string[] = []
	for (const settlement of settlements) {
		if (settlement.status === 'fulfilled') {
			results.push(settlement.value)
		} else {
			failures.push(
				settlement.reason instanceof Error ? settlement.reason.message : String(settlement.reason),
			)
		}
	}

	if (failures.length > 0) {
		throw new Error([...results, ...failures].join('\n'))
	}

	return { ok: true, output: results.join('\n') }
}

export async function submitReview(params: SubmitReviewParams): Promise<SubmitReviewResult> {
	const body = params.body?.trim()
	const latestHeadSha = await assertReviewTargetsLatestHead(params)
	if (params.event === 'approve') return submitApproval(params, body)

	const reviewFindings = filterNewFindings(
		params.pullRequest,
		dedupeFindings((params.findings ?? []).filter(isPublishableFinding)),
	)
	validatePublishableFindings(
		{ pullRequest: params.pullRequest, findings: reviewFindings },
		reviewFindings,
	)

	const comments =
		params.event === 'request_changes'
			? reviewFindings.map((finding) => ({
					body: getCommentBody(finding),
					line: finding.lineStart,
					path: finding.filePath,
					side: 'RIGHT' as const,
				}))
			: []

	const payload: {
		body?: string
		comments: Array<{
			body: string | undefined
			line: number | undefined
			path: string
			side: 'RIGHT'
		}>
		commit_id?: string
		event: 'APPROVE' | 'REQUEST_CHANGES'
	} = {
		comments,
		event: 'REQUEST_CHANGES',
	}
	if (body) Object.assign(payload, { body })
	if (comments.length > 0) {
		payload.commit_id = latestHeadSha
	}

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
	const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

	if (result.exitCode !== 0) {
		throw new Error(output || 'Failed to submit pull request review.')
	}

	return {
		ok: true,
		output: output || 'Submitted change request.',
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
	const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

	if (result.exitCode !== 0) {
		throw new Error(output || 'Failed to approve pull request.')
	}

	return { ok: true, output: output || 'Submitted approval.' }
}

async function assertReviewTargetsLatestHead(
	params: Pick<SubmitReviewParams, 'pullRequest' | 'reviewedHeadSha'>,
) {
	const latestHeadSha = await getLatestPullRequestHeadSha(params)
	const reviewedHeadSha = params.reviewedHeadSha || params.pullRequest.headSha
	if (latestHeadSha && reviewedHeadSha && latestHeadSha !== reviewedHeadSha) {
		throw new Error(
			`This draft review was generated for ${reviewedHeadSha.slice(0, 12)}, but the PR is now at ${latestHeadSha.slice(0, 12)}. Regenerate the review before publishing.`,
		)
	}
	return latestHeadSha
}

async function getLatestPullRequestHeadSha(params: Pick<SubmitReviewParams, 'pullRequest'>) {
	const result = await runGh([
		'api',
		`repos/${params.pullRequest.repo}/pulls/${params.pullRequest.pullRequestNumber}`,
		'--jq',
		'.head.sha',
	])
	const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
	if (result.exitCode !== 0) {
		throw new Error(output || 'Failed to load latest pull request head SHA.')
	}

	return result.stdout.trim() || params.pullRequest.headSha
}

function isPublishableFinding(finding: ReviewFinding) {
	return Boolean(finding.filePath && finding.lineStart && getCommentBody(finding))
}

function validatePublishableFindings(
	params: Pick<PublishReviewCommentsParams, 'findings' | 'pullRequest'>,
	findings: ReviewFinding[],
) {
	const changedFiles = new Set(params.pullRequest.files.map((file) => file.path))
	for (const finding of findings) {
		if (!changedFiles.has(finding.filePath)) {
			throw new Error(`Cannot publish comment for unchanged file: ${finding.filePath}.`)
		}
		if (!Number.isInteger(finding.lineStart) || !finding.lineStart || finding.lineStart < 1) {
			throw new Error(`Cannot publish comment with invalid line for ${finding.filePath}.`)
		}
	}
}

function dedupeFindings(findings: ReviewFinding[]) {
	const seen = new Set<string>()
	return findings.filter((finding) => {
		const key = `${finding.filePath}:${finding.lineStart}:${getCommentBody(finding)}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

function filterNewFindings(
	pullRequest: PublishReviewCommentsParams['pullRequest'],
	findings: ReviewFinding[],
) {
	const existingCommentKeys = new Set(
		pullRequest.reviewThreads.flatMap((thread) =>
			thread.comments.map((comment) =>
				getCommentKey({
					body: comment.body,
					line: thread.line,
					path: thread.path,
				}),
			),
		),
	)

	return findings.filter((finding) => {
		const body = getCommentBody(finding)
		if (!body) return true
		return !existingCommentKeys.has(
			getCommentKey({
				body,
				line: finding.lineStart,
				path: finding.filePath,
			}),
		)
	})
}

function getCommentKey(params: { body?: string; line?: number; path?: string }) {
	return `${params.path ?? ''}:${params.line ?? ''}:${normalizeCommentBody(params.body ?? '')}`
}

function normalizeCommentBody(body: string) {
	return body.trim().replace(/\s+/g, ' ').toLowerCase()
}

function getCommentBody(finding: ReviewFinding) {
	return getFindingCommentBody(finding).trim()
}

async function publishFinding(
	params: PublishReviewCommentsParams,
	finding: ReviewFinding,
	commitId: string,
): Promise<CommandResult> {
	const body = getCommentBody(finding)
	if (!body || !finding.lineStart) {
		throw new Error('Finding is missing a comment body or line number.')
	}

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
