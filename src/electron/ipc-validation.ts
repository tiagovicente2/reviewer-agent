import type { MainRequestName } from './ipc'

export function validateMainRequest(name: MainRequestName, params: unknown) {
	const validator = validators[name]
	if (validator) validator(params)
	else assertUndefined(params, name)
}

type Validator = (params: unknown) => void

const validators: Partial<Record<MainRequestName, Validator>> = {
	getAppSettings: (params) => assertUndefined(params, 'getAppSettings'),
	saveAppSettings: assertSaveAppSettings,
	completeOnboarding: (params) => assertUndefined(params, 'completeOnboarding'),
	listAvailablePiModels: assertOptionalAgentParams,
	listAgentAvailability: (params) => assertUndefined(params, 'listAgentAvailability'),
	getSystemColorMode: (params) => assertUndefined(params, 'getSystemColorMode'),
	getUpdateStatus: (params) => assertUndefined(params, 'getUpdateStatus'),
	getCacheStats: (params) => assertUndefined(params, 'getCacheStats'),
	clearAppCache: (params) => assertUndefined(params, 'clearAppCache'),
	installUpdate: (params) => assertUndefined(params, 'installUpdate'),
	getGitHubAuthStatus: (params) => assertUndefined(params, 'getGitHubAuthStatus'),
	startGitHubLogin: (params) => assertUndefined(params, 'startGitHubLogin'),
	listGitHubReviewRequests: (params) => assertUndefined(params, 'listGitHubReviewRequests'),
	searchGitHubPullRequests: assertSearchParams,
	getGitHubPullRequestForReview: (params) => assertStringObject(params, 'query'),
	getGitHubPullRequestDetails: assertPullRequestLookup,
	getGitHubPullRequestDiff: assertPullRequestDiffLookup,
	getGitHubAsset: (params) => assertUrlObject(params, 'url'),
	generateReviewWithPi: assertGenerateReviewParams,
	startPiReviewGeneration: assertGenerateReviewParams,
	getPiReviewGenerationJob: (params) => assertStringObject(params, 'jobId'),
	getSavedPiReview: assertSavedReviewLookup,
	openExternalUrl: (params) => assertUrlObject(params, 'url'),
	minimizeWindow: (params) => assertUndefined(params, 'minimizeWindow'),
	toggleMaximizeWindow: (params) => assertUndefined(params, 'toggleMaximizeWindow'),
	closeWindow: (params) => assertUndefined(params, 'closeWindow'),
	publishPiReviewComment: assertPublishCommentParams,
	publishPiReviewComments: assertPublishCommentsParams,
	submitPiReview: assertSubmitReviewParams,
}

function assertUndefined(params: unknown, name: string) {
	if (params !== undefined) throw new Error(`Invalid params for ${name}.`)
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Expected an object.')
	}
}

function assertString(value: unknown, field: string) {
	if (typeof value !== 'string') throw new Error(`Expected ${field} to be a string.`)
}

function assertOptionalString(value: unknown, field: string) {
	if (value !== undefined) assertString(value, field)
}

function assertNumber(value: unknown, field: string) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Expected ${field} to be a finite number.`)
	}
}

function assertBoolean(value: unknown, field: string) {
	if (typeof value !== 'boolean') throw new Error(`Expected ${field} to be a boolean.`)
}

function assertStringObject(
	params: unknown,
	field: string,
): asserts params is Record<string, unknown> {
	assertPlainObject(params)
	assertString(params[field], field)
}

function assertUrlObject(params: unknown, field: string) {
	assertStringObject(params, field)
	const url = new URL(params[field] as string)
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error(`Expected ${field} to be an HTTP(S) URL.`)
	}
}

function assertOptionalAgentParams(params: unknown) {
	if (params === undefined) return
	assertPlainObject(params)
	if (
		params.agent !== undefined &&
		!['pi', 'claude', 'opencode', 'codex'].includes(String(params.agent))
	) {
		throw new Error('Invalid code agent.')
	}
}

function assertSaveAppSettings(params: unknown) {
	assertPlainObject(params)
	if (!['dark', 'light', 'system'].includes(String(params.colorMode)))
		throw new Error('Invalid color mode.')
	if (!['pi', 'claude', 'opencode', 'codex'].includes(String(params.codeAgent)))
		throw new Error('Invalid code agent.')
	assertString(params.model, 'model')
	if (!['english', 'portuguese'].includes(String(params.reviewLanguage)))
		throw new Error('Invalid review language.')
	assertString(params.reviewerInstructions, 'reviewerInstructions')
}

function assertSearchParams(params: unknown) {
	assertPlainObject(params)
	assertString(params.query, 'query')
	if (
		params.mode !== undefined &&
		!['smart', 'repo', 'author', 'title', 'review-requested'].includes(String(params.mode))
	) {
		throw new Error('Invalid search mode.')
	}
}

function assertPullRequestLookup(params: unknown) {
	assertPlainObject(params)
	assertString(params.repo, 'repo')
	assertNumber(params.pullRequestNumber, 'pullRequestNumber')
}

function assertPullRequestDiffLookup(params: unknown) {
	assertPullRequestLookup(params)
	assertString((params as Record<string, unknown>).headSha, 'headSha')
}

function assertSavedReviewLookup(params: unknown) {
	assertPullRequestDiffLookup(params)
}

function assertGenerateReviewParams(params: unknown) {
	assertPlainObject(params)
	assertPullRequestDetails(params.pullRequest)
}

function assertPublishCommentParams(params: unknown) {
	assertPlainObject(params)
	assertPullRequestDetails(params.pullRequest)
	assertFinding(params.finding)
}

function assertPublishCommentsParams(params: unknown) {
	assertPlainObject(params)
	assertPullRequestDetails(params.pullRequest)
	if (!Array.isArray(params.findings)) throw new Error('Expected findings to be an array.')
	for (const finding of params.findings) assertFinding(finding)
}

function assertSubmitReviewParams(params: unknown) {
	assertPlainObject(params)
	assertPullRequestDetails(params.pullRequest)
	if (!['approve', 'request_changes'].includes(String(params.event))) {
		throw new Error('Invalid review event.')
	}
	assertOptionalString(params.body, 'body')
	if (params.findings !== undefined) {
		if (!Array.isArray(params.findings)) throw new Error('Expected findings to be an array.')
		for (const finding of params.findings) assertFinding(finding)
	}
}

function assertPullRequestDetails(value: unknown) {
	assertPlainObject(value)
	assertString(value.repo, 'pullRequest.repo')
	assertNumber(value.pullRequestNumber, 'pullRequest.pullRequestNumber')
	assertString(value.title, 'pullRequest.title')
	assertString(value.author, 'pullRequest.author')
	assertString(value.url, 'pullRequest.url')
	assertString(value.body, 'pullRequest.body')
	assertString(value.state, 'pullRequest.state')
	assertBoolean(value.isDraft, 'pullRequest.isDraft')
	assertString(value.headSha, 'pullRequest.headSha')
	assertString(value.headRefName, 'pullRequest.headRefName')
	assertString(value.baseRefName, 'pullRequest.baseRefName')
	assertNumber(value.changedFilesCount, 'pullRequest.changedFilesCount')
	assertNumber(value.additions, 'pullRequest.additions')
	assertNumber(value.deletions, 'pullRequest.deletions')
	assertOptionalString(value.reviewDecision, 'pullRequest.reviewDecision')
	if (!Array.isArray(value.reviews)) throw new Error('Expected pullRequest.reviews to be an array.')
	if (!Array.isArray(value.files)) throw new Error('Expected pullRequest.files to be an array.')
	assertString(value.diff, 'pullRequest.diff')
}

function assertFinding(value: unknown) {
	assertPlainObject(value)
	assertString(value.id, 'finding.id')
	if (!['critical', 'high', 'medium', 'low', 'info'].includes(String(value.severity))) {
		throw new Error('Invalid finding severity.')
	}
	assertString(value.title, 'finding.title')
	assertString(value.filePath, 'finding.filePath')
	assertString(value.body, 'finding.body')
	assertOptionalString(value.suggestedCommentBody, 'finding.suggestedCommentBody')
	assertNumber(value.confidence, 'finding.confidence')
}
