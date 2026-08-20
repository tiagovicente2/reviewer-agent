export type UpdateStage =
	| 'idle'
	| 'checking'
	| 'available'
	| 'downloading'
	| 'installing'
	| 'ready'
	| 'error'

export type UpdateStatus = {
	currentVersion: string
	latestVersion?: string
	latestUrl?: string
	available: boolean
	checking: boolean
	stage?: UpdateStage
	progress?: number
	statusMessage?: string
	error?: string
}

export type UpdateResult = {
	ok: boolean
	message: string
}
