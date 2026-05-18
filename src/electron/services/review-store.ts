import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { PiGeneratedReview } from '@/shared/review'

type StoredReview = {
	repo: string
	pullRequestNumber: number
	headSha: string
	review: PiGeneratedReview
	createdAt: string
	updatedAt: string
}

const storePath = getStorePath()
mkdirSync(dirname(storePath), { recursive: true })

export function saveGeneratedReview(params: {
	pullRequest: GitHubPullRequestDetails
	review: PiGeneratedReview
}): PiGeneratedReview {
	const store = readStore()
	const id = getReviewStoreKey(params.pullRequest)
	const now = new Date().toISOString()
	store[id] = {
		repo: params.pullRequest.repo,
		pullRequestNumber: params.pullRequest.pullRequestNumber,
		headSha: params.pullRequest.headSha,
		review: params.review,
		createdAt: store[id]?.createdAt ?? now,
		updatedAt: now,
	}
	writeStore(store)
	return params.review
}

export function getSavedGeneratedReview(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}): PiGeneratedReview | null {
	return readStore()[getReviewStoreKey(params)]?.review ?? null
}

function readStore(): Record<string, StoredReview> {
	try {
		return existsSync(storePath) ? JSON.parse(readFileSync(storePath, 'utf8')) : {}
	} catch {
		return {}
	}
}

function writeStore(store: Record<string, StoredReview>) {
	writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`)
}

function getReviewStoreKey(params: { repo: string; pullRequestNumber: number; headSha: string }) {
	return `${params.repo}#${params.pullRequestNumber}:${params.headSha}`
}

function getStorePath() {
	const baseDir =
		process.env.XDG_DATA_HOME ??
		(process.env.HOME ? join(process.env.HOME, '.local', 'share') : join(process.cwd(), '.data'))
	return join(baseDir, 'pr-review-agent', 'generated-reviews.json')
}
