import type { MainRequestName } from './ipc'

export function validateMainRequest(name: MainRequestName, params: unknown) {
	const validator = validators[name]
	if (validator) validator(params)
	else assertUndefined(params, name)
}

type Validator = (params: unknown) => void

const MAX_SHORT_TEXT_LENGTH = 2_000
const MAX_LONG_TEXT_LENGTH = 100_000
const MAX_DIFF_LENGTH = 1_000_000
const MAX_FINDINGS = 100

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
	generateReview: assertGenerateReviewParams,
	startReviewGeneration: assertGenerateReviewParams,
	getReviewGenerationJob: (params) => assertStringObject(params, 'jobId'),
	getSavedReview: assertSavedReviewLookup,
	exportReviewToFile: assertExportReviewParams,
	selectReviewExportDirectory: assertSelectReviewExportDirectoryParams,
	openExternalUrl: (params) => assertUrlObject(params, 'url'),
	minimizeWindow: (params) => assertUndefined(params, 'minimizeWindow'),
	toggleMaximizeWindow: (params) => assertUndefined(params, 'toggleMaximizeWindow'),
	closeWindow: (params) => assertUndefined(params, 'closeWindow'),
	publishReviewComment: assertPublishCommentParams,
	publishReviewComments: assertPublishCommentsParams,
	submitReview: assertSubmitReviewParams,
}

function assertUndefined(params: unknown, name: string) {
	if (params !== undefined) throw new Error(`Invalid params for ${name}.`)
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Expected an object.')
	}
}

function assertOnlyFields(value: Record<string, unknown>, fields: string[], name: string) {
	const allowed = new Set(fields)
	for (const field of Object.keys(value)) {
		if (!allowed.has(field)) throw new Error(`Unexpected field ${field} for ${name}.`)
	}
}

function assertString(
	value: unknown,
	field: string,
	maxLength = MAX_SHORT_TEXT_LENGTH,
): asserts value is string {
	if (typeof value !== 'string') throw new Error(`Expected ${field} to be a string.`)
	if (value.length > maxLength) throw new Error(`${field} is too long.`)
}

function assertOptionalString(value: unknown, field: string) {
	if (value !== undefined) assertString(value, field)
}

function assertNumber(value: unknown, field: string): asserts value is number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Expected ${field} to be a finite number.`)
	}
}

function assertNonNegativeInteger(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER) {
	assertNumber(value, field)
	if (!Number.isInteger(value) || value < 0 || value > max) {
		throw new Error(`Expected ${field} to be a non-negative integer.`)
	}
}

function assertPositiveInteger(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER) {
	assertNumber(value, field)
	if (!Number.isInteger(value) || value <= 0 || value > max) {
		throw new Error(`Expected ${field} to be a positive integer.`)
	}
}

function assertRepo(value: unknown, field: string) {
	assertString(value, field, 200)
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
		throw new Error(`Expected ${field} to be an owner/name repository.`)
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
	assertString(params.reviewerInstructions, 'reviewerInstructions', MAX_LONG_TEXT_LENGTH)
	assertString(params.reviewExportDirectory, 'reviewExportDirectory')
}

function assertSearchParams(params: unknown) {
	assertPlainObject(params)
	assertOnlyFields(params, ['query', 'mode'], 'searchGitHubPullRequests')
	assertString(params.query, 'query', 500)
	if (
		params.mode !== undefined &&
		!['smart', 'repo', 'author', 'title', 'review-requested'].includes(String(params.mode))
	) {
		throw new Error('Invalid search mode.')
	}
}

function assertPullRequestLookup(params: unknown) {
	assertPlainObject(params)
	assertOnlyFields(params, ['repo', 'pullRequestNumber', 'headSha'], 'pull request lookup')
	assertRepo(params.repo, 'repo')
	assertPositiveInteger(params.pullRequestNumber, 'pullRequestNumber')
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
	if (params.findings.length > MAX_FINDINGS) throw new Error('Too many findings.')
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
		if (params.findings.length > MAX_FINDINGS) throw new Error('Too many findings.')
		for (const finding of params.findings) assertFinding(finding)
	}
}

function assertExportReviewParams(params: unknown) {
	assertPlainObject(params)
	assertPullRequestDetails(params.pullRequest)
	assertGeneratedReview(params.review)
}

function assertSelectReviewExportDirectoryParams(params: unknown) {
	assertPlainObject(params)
	assertOnlyFields(params, ['currentDirectory'], 'selectReviewExportDirectory')
	assertOptionalString(params.currentDirectory, 'currentDirectory')
}

function assertPullRequestDetails(value: unknown) {
	assertPlainObject(value)
	assertRepo(value.repo, 'pullRequest.repo')
	assertPositiveInteger(value.pullRequestNumber, 'pullRequest.pullRequestNumber')
	assertString(value.title, 'pullRequest.title')
	assertString(value.author, 'pullRequest.author')
	assertString(value.url, 'pullRequest.url', 2_000)
	assertString(value.body, 'pullRequest.body', MAX_LONG_TEXT_LENGTH)
	assertString(value.state, 'pullRequest.state', 100)
	assertBoolean(value.isDraft, 'pullRequest.isDraft')
	assertString(value.headSha, 'pullRequest.headSha', 100)
	assertString(value.headRefName, 'pullRequest.headRefName')
	assertString(value.baseRefName, 'pullRequest.baseRefName')
	assertNonNegativeInteger(value.changedFilesCount, 'pullRequest.changedFilesCount', 10_000)
	assertNonNegativeInteger(value.additions, 'pullRequest.additions')
	assertNonNegativeInteger(value.deletions, 'pullRequest.deletions')
	assertOptionalString(value.reviewDecision, 'pullRequest.reviewDecision')
	if (!Array.isArray(value.reviews)) throw new Error('Expected pullRequest.reviews to be an array.')
	if (!Array.isArray(value.files)) throw new Error('Expected pullRequest.files to be an array.')
	if (value.files.length > 10_000) throw new Error('Too many pull request files.')
	for (const file of value.files) assertPullRequestFile(file)
	assertString(value.diff, 'pullRequest.diff', MAX_DIFF_LENGTH)
}

function assertFinding(value: unknown) {
	assertPlainObject(value)
	assertString(value.id, 'finding.id', 200)
	if (!['critical', 'high', 'medium', 'low', 'info'].includes(String(value.severity))) {
		throw new Error('Invalid finding severity.')
	}
	assertString(value.title, 'finding.title')
	assertString(value.filePath, 'finding.filePath')
	assertString(value.body, 'finding.body', MAX_LONG_TEXT_LENGTH)
	assertOptionalString(value.suggestedCommentBody, 'finding.suggestedCommentBody')
	assertNumber(value.confidence, 'finding.confidence')
	if (value.confidence < 0 || value.confidence > 1) throw new Error('Invalid finding confidence.')
	if (value.lineStart !== undefined) assertPositiveInteger(value.lineStart, 'finding.lineStart')
	if (value.lineEnd !== undefined) assertPositiveInteger(value.lineEnd, 'finding.lineEnd')
}

function assertGeneratedReview(value: unknown) {
	assertPlainObject(value)
	assertString(value.summary, 'review.summary', MAX_LONG_TEXT_LENGTH)
	assertString(value.publishableBody, 'review.publishableBody', MAX_LONG_TEXT_LENGTH)
	if (!['comment', 'approve', 'request_changes'].includes(String(value.verdictRecommendation))) {
		throw new Error('Invalid review verdict recommendation.')
	}
	if (!['critical', 'high', 'medium', 'low', 'info'].includes(String(value.severity))) {
		throw new Error('Invalid review severity.')
	}
	if (!Array.isArray(value.findings)) throw new Error('Expected review.findings to be an array.')
	if (value.findings.length > MAX_FINDINGS) throw new Error('Too many findings.')
	for (const finding of value.findings) assertFinding(finding)
	if (!Array.isArray(value.inlineComments))
		throw new Error('Expected review.inlineComments to be an array.')
	assertString(value.rawOutput, 'review.rawOutput', MAX_LONG_TEXT_LENGTH)
	assertString(value.modelLabel, 'review.modelLabel')
	assertString(value.generatedAt, 'review.generatedAt')
	assertBoolean(value.diffWasTruncated, 'review.diffWasTruncated')
}

function assertPullRequestFile(value: unknown) {
	assertPlainObject(value)
	assertString(value.path, 'pullRequest.files.path')
	assertNonNegativeInteger(value.additions, 'pullRequest.files.additions')
	assertNonNegativeInteger(value.deletions, 'pullRequest.files.deletions')
}
