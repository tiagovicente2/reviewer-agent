export type UpdateStatus = {
	currentVersion: string
	latestVersion?: string
	latestUrl?: string
	available: boolean
	checking: boolean
	error?: string
}

export type UpdateResult = {
	ok: boolean
	message: string
}
