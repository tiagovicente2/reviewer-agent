import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { GitHubPullRequestDetails } from '@/shared/github'
import { getUserDataPath } from '../paths'
import { pruneRecordByUpdatedAt, writeJsonFileAtomically } from './json-store'

type DetailsEntry = {
	repo: string
	pullRequestNumber: number
	headSha: string
	details: GitHubPullRequestDetails
	createdAt: string
	updatedAt: string
}

type DiffEntry = {
	repo: string
	pullRequestNumber: number
	headSha: string
	diff: string
	createdAt: string
	updatedAt: string
}

type PullRequestCache = {
	details: Record<string, DetailsEntry>
	diffs: Record<string, DiffEntry>
}

const cachePath = join(getUserDataPath(), 'pull-request-cache.json')
mkdirSync(dirname(cachePath), { recursive: true })

const MAX_PULL_REQUEST_DETAILS = 300
const MAX_PULL_REQUEST_DIFFS = 150

const cache = loadCache()
let writeQueued = false

export function getCachedPullRequestDetails(params: {
	repo: string
	pullRequestNumber: number
	headSha?: string
}): GitHubPullRequestDetails | null {
	if (params.headSha) {
		return (
			cache.details[getPullRequestCacheKey({ ...params, headSha: params.headSha })]?.details ?? null
		)
	}

	const entries = Object.values(cache.details)
		.filter(
			(entry) => entry.repo === params.repo && entry.pullRequestNumber === params.pullRequestNumber,
		)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
	return entries[0]?.details ?? null
}

export function saveCachedPullRequestDetails(details: GitHubPullRequestDetails) {
	const metadata = { ...details, diff: '' }
	const now = new Date().toISOString()
	const id = getPullRequestCacheKey(details)
	cache.details[id] = {
		repo: details.repo,
		pullRequestNumber: details.pullRequestNumber,
		headSha: details.headSha,
		details: metadata,
		createdAt: cache.details[id]?.createdAt ?? now,
		updatedAt: now,
	}
	pruneCache()
	queueWriteCache()
}

export function getCachedPullRequestDiff(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}): string | null {
	return cache.diffs[getPullRequestCacheKey(params)]?.diff ?? null
}

export function saveCachedPullRequestDiff(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
	diff: string
}) {
	const now = new Date().toISOString()
	const id = getPullRequestCacheKey(params)
	cache.diffs[id] = {
		repo: params.repo,
		pullRequestNumber: params.pullRequestNumber,
		headSha: params.headSha,
		diff: params.diff,
		createdAt: cache.diffs[id]?.createdAt ?? now,
		updatedAt: now,
	}
	pruneCache()
	queueWriteCache()
}

function loadCache(): PullRequestCache {
	try {
		const persisted = JSON.parse(readFileSync(cachePath, 'utf8')) as Partial<PullRequestCache>
		return { details: persisted.details ?? {}, diffs: persisted.diffs ?? {} }
	} catch {
		return { details: {}, diffs: {} }
	}
}

function queueWriteCache() {
	if (writeQueued) return
	writeQueued = true
	queueMicrotask(() => {
		writeQueued = false
		void writeJsonFileAtomically(cachePath, cache).catch((error: unknown) => {
			console.error('Could not persist pull request cache.', error)
		})
	})
}

export function getPullRequestCacheStats() {
	return {
		pullRequestDetails: Object.keys(cache.details).length,
		pullRequestDiffs: Object.keys(cache.diffs).length,
	}
}

export function clearPullRequestCache(): { removedDetails: number; removedDiffs: number } {
	const removedDetails = Object.keys(cache.details).length
	const removedDiffs = Object.keys(cache.diffs).length
	cache.details = {}
	cache.diffs = {}
	rmSync(cachePath, { force: true })
	return { removedDetails, removedDiffs }
}

function pruneCache() {
	cache.details = pruneRecordByUpdatedAt(cache.details, MAX_PULL_REQUEST_DETAILS)
	cache.diffs = pruneRecordByUpdatedAt(cache.diffs, MAX_PULL_REQUEST_DIFFS)
}

function getPullRequestCacheKey(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}) {
	return `${params.repo}#${params.pullRequestNumber}:${params.headSha}`
}
