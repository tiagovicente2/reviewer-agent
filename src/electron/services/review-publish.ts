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
	return publishReviewComments({ pullRequest: params.pullRequest, findings: [params.finding] })
}

export async function publishReviewComments(
	params: PublishReviewCommentsParams,
): Promise<PublishReviewCommentResult> {
	const publishableFindings = params.findings.filter(isPublishableFinding)
	if (publishableFindings.length === 0) {
		throw new Error(
			'No publishable inline findings. Findings need filePath, lineStart, and a comment body.',
		)
	}

	const results: string[] = []

	for (const finding of publishableFindings) {
		const result = await publishFinding(params, finding)
		const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

		if (result.exitCode !== 0) {
			throw new Error(
				output || `Failed to publish comment for ${finding.filePath}:${finding.lineStart}.`,
			)
		}

		results.push(`Published comment for ${finding.filePath}:${finding.lineStart}`)
	}

	return { ok: true, output: results.join('\n') }
}

export async function submitReview(params: SubmitReviewParams): Promise<SubmitReviewResult> {
	const body = params.body?.trim()
	if (params.event === 'approve') return submitApproval(params, body)

	const comments =
		params.event === 'request_changes'
			? (params.findings ?? []).filter(isPublishableFinding).map((finding) => ({
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
		payload.commit_id = await getLatestPullRequestHeadSha(params)
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

async function getLatestPullRequestHeadSha(params: SubmitReviewParams) {
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

function getCommentBody(finding: ReviewFinding) {
	return finding.suggestedCommentBody || finding.body
}

async function publishFinding(
	params: PublishReviewCommentsParams,
	finding: ReviewFinding,
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
		`commit_id=${params.pullRequest.headSha}`,
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
