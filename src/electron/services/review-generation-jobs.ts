import type { GenerateReviewParams, ReviewGenerationJob } from '@/shared/review'
import { formatInitialVisibleReviewOutput } from './agent-json-stream'
import { generateReview } from './review-generation'
import { getReviewCodeAgent } from './settings'

type StoredJob = ReviewGenerationJob & {
	promise?: Promise<void>
	progressTimer?: NodeJS.Timeout
}

function getAgentLabel() {
	const agent = getReviewCodeAgent()
	if (agent === 'claude') return 'Claude'
	if (agent === 'opencode') return 'opencode'
	if (agent === 'codex') return 'Codex'
	return 'Pi'
}

function getProgressMessages() {
	const agent = getAgentLabel()
	return [
		`${agent} is reading the PR metadata and diff...`,
		`${agent} is checking the changed files for correctness issues...`,
		`${agent} is looking for regressions, edge cases, and risky assumptions...`,
		`${agent} is drafting concise GitHub review comments...`,
		`${agent} is finishing the review output...`,
	]
}

const jobs = new Map<string, StoredJob>()
const reviewPromptLabel = 'Generate a draft GitHub pull request review'

export function startReviewGeneration(params: GenerateReviewParams): ReviewGenerationJob {
	const jobId = getJobId(params)
	const existing = jobs.get(jobId)
	if (existing?.status === 'running') {
		return toPublicJob(existing)
	}

	const startedAt = new Date().toISOString()
	const agent = getAgentLabel()
	const job: StoredJob = {
		id: jobId,
		pullRequestKey: getPullRequestKey(params),
		outputText: formatInitialVisibleReviewOutput({
			promptLabel: reviewPromptLabel,
			statusMessages: [`Starting ${agent} review process...`],
		}),
		status: 'running',
		statusMessage: `${agent} is reading the PR metadata and diff...`,
		startedAt,
	}

	job.progressTimer = startProgressTimer(jobId, job)
	job.promise = generateReview(params, {
		onProgress: ({ message, outputText }) => {
			if (!message && outputText === undefined) return
			const current = jobs.get(jobId) ?? job
			if (current.status !== 'running') return
			jobs.set(jobId, {
				...current,
				outputText: outputText ?? current.outputText,
				statusMessage: message ?? current.statusMessage,
			})
		},
	})
		.then((review) => {
			const current = jobs.get(jobId) ?? job
			clearProgressTimer(current)
			jobs.set(jobId, {
				...current,
				progressTimer: undefined,
				status: 'completed',
				statusMessage: `${agent} finished the draft review.`,
				review,
				finishedAt: new Date().toISOString(),
			})
		})
		.catch((error: unknown) => {
			const current = jobs.get(jobId) ?? job
			clearProgressTimer(current)
			jobs.set(jobId, {
				...current,
				progressTimer: undefined,
				status: 'failed',
				statusMessage: `${agent} could not finish the draft review.`,
				error: error instanceof Error ? error.message : String(error),
				finishedAt: new Date().toISOString(),
			})
		})

	jobs.set(jobId, job)
	return toPublicJob(job)
}

export function getReviewGenerationJob(params: { jobId: string }): ReviewGenerationJob | null {
	const job = jobs.get(params.jobId)
	return job ? toPublicJob(job) : null
}

function toPublicJob(job: StoredJob): ReviewGenerationJob {
	const { progressTimer: _progressTimer, promise: _promise, ...publicJob } = job
	return publicJob
}

function startProgressTimer(jobId: string, initialJob: StoredJob) {
	let index = 0
	const progressMessages = getProgressMessages()
	return setInterval(() => {
		const current = jobs.get(jobId) ?? initialJob
		if (current.status !== 'running') {
			clearProgressTimer(current)
			return
		}

		index = Math.min(index + 1, progressMessages.length - 1)
		jobs.set(jobId, {
			...current,
			statusMessage: progressMessages[index],
		})
	}, 7000)
}

function clearProgressTimer(job: StoredJob) {
	if (job.progressTimer) {
		clearInterval(job.progressTimer)
	}
}

function getJobId(params: GenerateReviewParams) {
	return `review-generation:${getPullRequestKey(params)}`
}

function getPullRequestKey(params: GenerateReviewParams) {
	const pr = params.pullRequest
	return `${pr.repo}#${pr.pullRequestNumber}:${pr.headSha}`
}
