import type {
	PiReviewFinding,
	PublishPiReviewCommentParams,
	PublishPiReviewCommentResult,
	PublishPiReviewCommentsParams,
} from '@/shared/review'
import { runCommand } from '../process'

const GH_PUBLISH_TIMEOUT_MS = 60 * 1000

type CommandResult = {
	exitCode: number
	stdout: string
	stderr: string
}

export async function publishPiReviewComment(
	params: PublishPiReviewCommentParams,
): Promise<PublishPiReviewCommentResult> {
	return publishPiReviewComments({ pullRequest: params.pullRequest, findings: [params.finding] })
}

export async function publishPiReviewComments(
	params: PublishPiReviewCommentsParams,
): Promise<PublishPiReviewCommentResult> {
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

function isPublishableFinding(finding: PiReviewFinding) {
	return Boolean(finding.filePath && finding.lineStart && getCommentBody(finding))
}

function getCommentBody(finding: PiReviewFinding) {
	return finding.suggestedCommentBody || finding.body
}

async function publishFinding(
	params: PublishPiReviewCommentsParams,
	finding: PiReviewFinding,
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

async function runGh(args: string[]): Promise<CommandResult> {
	return runCommand('gh', args, {
		env: process.env,
		timeoutMs: GH_PUBLISH_TIMEOUT_MS,
	})
}
