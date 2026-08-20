import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform, type TransformCallback } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'
import type { UpdateResult, UpdateStatus } from '@/shared/update'
import { compareVersions, normalizeVersion } from '@/shared/version'
import { getExpectedChecksum, getUpdateArtifactName } from './update-integrity'

const REPO = 'tiagovicente2/reviewer-agent'
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASE_DOWNLOAD_BASE_URL = `https://github.com/${REPO}/releases/download`
const CHECKSUM_ASSET_NAME = 'SHA256SUMS'

type GitHubLatestRelease = {
	tag_name?: string
	html_url?: string
	assets?: Array<{ name?: string }>
}

type LatestRelease = {
	assetNames: Set<string>
	htmlUrl?: string
	tagName: string
	version: string
}

let updateStatusNotifier: ((status: UpdateStatus) => void) | null = null

export function setUpdateStatusNotifier(notifier: ((status: UpdateStatus) => void) | null) {
	updateStatusNotifier = notifier
}

let currentStatus: UpdateStatus = {
	currentVersion: app.getVersion(),
	available: false,
	checking: false,
	stage: 'idle',
}

function updateStatus(patch: Partial<UpdateStatus>): UpdateStatus {
	currentStatus = { ...currentStatus, ...patch }
	updateStatusNotifier?.(currentStatus)
	return currentStatus
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
	if (
		currentStatus.stage === 'downloading' ||
		currentStatus.stage === 'installing' ||
		currentStatus.stage === 'ready'
	) {
		return currentStatus
	}
	return checkForUpdates(false)
}

export async function checkForUpdates(autoInstall = true): Promise<UpdateStatus> {
	if (
		currentStatus.stage === 'downloading' ||
		currentStatus.stage === 'installing' ||
		currentStatus.stage === 'ready'
	) {
		return currentStatus
	}

	const currentVersion = app.getVersion()
	updateStatus({
		currentVersion,
		checking: true,
		stage: 'checking',
		error: undefined,
	})

	try {
		const release = await getLatestRelease()
		const available = compareVersions(release.version, currentVersion) > 0

		updateStatus({
			currentVersion,
			latestVersion: release.version,
			latestUrl: release.htmlUrl,
			available,
			checking: false,
			stage: available ? 'available' : 'idle',
		})

		if (available && autoInstall) {
			void installUpdate()
		}

		return currentStatus
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Could not check for updates.'
		return updateStatus({
			currentVersion,
			available: false,
			checking: false,
			stage: 'error',
			error: errorMessage,
		})
	}
}

let activeInstallPromise: Promise<UpdateResult> | null = null

export async function installUpdate(): Promise<UpdateResult> {
	if (activeInstallPromise) {
		return activeInstallPromise
	}
	if (currentStatus.stage === 'ready') {
		return { ok: true, message: 'Update is already downloaded and ready to restart.' }
	}

	activeInstallPromise = executeInstallUpdate()
	try {
		return await activeInstallPromise
	} finally {
		activeInstallPromise = null
	}
}

async function executeInstallUpdate(): Promise<UpdateResult> {
	let temporaryDirectory: string | undefined
	try {
		const release = await getLatestRelease()
		if (compareVersions(release.version, app.getVersion()) <= 0) {
			updateStatus({ available: false, stage: 'idle' })
			return { ok: false, message: 'No update is available.' }
		}

		const artifactName = getUpdateArtifactName(process.platform, process.arch)
		if (!artifactName) {
			const message = `Auto-update is not supported on ${process.platform}/${process.arch}.`
			updateStatus({ stage: 'error', error: message })
			return { ok: false, message }
		}
		if (!release.assetNames.has(artifactName) || !release.assetNames.has(CHECKSUM_ASSET_NAME)) {
			const message = 'The release is missing a signed-off archive or checksum file.'
			updateStatus({ stage: 'error', error: message })
			return { ok: false, message }
		}

		updateStatus({
			stage: 'downloading',
			progress: 0,
			statusMessage: 'Downloading update…',
			available: true,
			latestVersion: release.version,
			latestUrl: release.htmlUrl,
			error: undefined,
		})

		const checksumManifest = await downloadText(
			getReleaseAssetUrl(release.tagName, CHECKSUM_ASSET_NAME),
		)
		const expectedChecksum = getExpectedChecksum(checksumManifest, artifactName)
		if (!expectedChecksum) {
			const message = `The checksum file does not include ${artifactName}.`
			updateStatus({ stage: 'error', error: message })
			return { ok: false, message }
		}

		temporaryDirectory = await mkdtemp(join(tmpdir(), 'reviewer-agent-update-'))
		const artifactPath = join(temporaryDirectory, artifactName)

		const actualChecksum = await downloadAndHash(
			getReleaseAssetUrl(release.tagName, artifactName),
			artifactPath,
			(percent) => {
				updateStatus({
					stage: 'downloading',
					progress: percent,
					statusMessage: `Downloading update (${percent}%)…`,
				})
			},
		)

		if (actualChecksum !== expectedChecksum) {
			const message = `Checksum verification failed for ${artifactName}.`
			updateStatus({ stage: 'error', error: message })
			return { ok: false, message }
		}

		updateStatus({
			stage: 'installing',
			progress: 100,
			statusMessage: 'Installing update in the background…',
		})

		const command = getUpdateCommand(artifactPath)
		const result = await runUpdateInstaller(command)
		if (!result.ok) {
			updateStatus({ stage: 'error', error: result.message })
			return result
		}

		updateStatus({
			stage: 'ready',
			available: true,
			progress: 100,
			statusMessage: 'Update installed. Ready to restart.',
		})

		return { ok: true, message: 'Update installed. Ready to restart.' }
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not install the update.'
		updateStatus({ stage: 'error', error: message })
		return {
			ok: false,
			message,
		}
	} finally {
		if (temporaryDirectory) await rm(temporaryDirectory, { force: true, recursive: true })
	}
}

export function restartApp(): { ok: true } {
	restartAppAfterUpdate()
	return { ok: true }
}

export function startBackgroundUpdateCheck() {
	setTimeout(() => {
		void checkForUpdates(true)
	}, 1500)
}

async function runUpdateInstaller(command: {
	command: string
	args: string[]
	env: NodeJS.ProcessEnv
}): Promise<UpdateResult> {
	return new Promise((resolve) => {
		const child = spawn(command.command, command.args, {
			env: command.env,
			stdio: 'ignore',
			windowsHide: true,
		})

		child.once('error', (error) => {
			resolve({ ok: false, message: `Could not start updater: ${error.message}` })
		})

		child.once('close', (exitCode) => {
			if (exitCode === 0) {
				resolve({ ok: true, message: 'Update installed. Ready to restart.' })
				return
			}
			resolve({ ok: false, message: `Updater exited with code ${exitCode ?? 'unknown'}.` })
		})
	})
}

function restartAppAfterUpdate() {
	if (process.platform === 'linux' || process.platform === 'darwin') {
		const child = spawn(
			'sh',
			['-lc', `(sleep 1; ${shellQuote(process.execPath)} >/dev/null 2>&1) &`],
			{
				detached: true,
				stdio: 'ignore',
				windowsHide: true,
			},
		)
		child.unref()
		app.quit()
		return
	}

	app.relaunch()
	app.quit()
}

function shellQuote(value: string) {
	return `'${value.replaceAll("'", "'\\''")}'`
}

function getUpdateCommand(artifactPath: string): {
	command: string
	args: string[]
	env: NodeJS.ProcessEnv
} {
	const env = { ...process.env, REVIEWER_AGENT_ARTIFACT_PATH: artifactPath }
	const scriptsDirectory = app.isPackaged
		? join(process.resourcesPath, 'scripts')
		: join(app.getAppPath(), 'scripts')

	if (process.platform === 'win32') {
		return {
			command: 'powershell.exe',
			args: [
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-File',
				join(scriptsDirectory, 'install.ps1'),
			],
			env,
		}
	}

	return {
		command: 'bash',
		args: [join(scriptsDirectory, 'install.sh')],
		env,
	}
}

async function getLatestRelease(): Promise<LatestRelease> {
	const response = await fetch(LATEST_RELEASE_API_URL, {
		headers: { Accept: 'application/vnd.github+json' },
	})
	if (!response.ok) throw new Error(`GitHub returned ${response.status}`)

	const release = (await response.json()) as GitHubLatestRelease
	const tagName = release.tag_name ?? ''
	const version = normalizeVersion(tagName)
	if (!version || !/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tagName)) {
		throw new Error('Latest release version is missing or invalid.')
	}

	return {
		assetNames: new Set(release.assets?.flatMap((asset) => (asset.name ? [asset.name] : []))),
		htmlUrl: release.html_url,
		tagName,
		version,
	}
}

function getReleaseAssetUrl(tagName: string, assetName: string) {
	return `${RELEASE_DOWNLOAD_BASE_URL}/${encodeURIComponent(tagName)}/${encodeURIComponent(assetName)}`
}

async function downloadText(url: string) {
	const response = await fetch(url)
	if (!response.ok)
		throw new Error(`Could not download checksums: GitHub returned ${response.status}.`)
	return response.text()
}

async function downloadAndHash(
	url: string,
	destination: string,
	onProgress?: (percent: number, downloaded: number, total?: number) => void,
) {
	const response = await fetch(url)
	if (!response.ok || !response.body) {
		throw new Error(`Could not download update: GitHub returned ${response.status}.`)
	}

	const contentLength = response.headers.get('content-length')
	const total = contentLength ? parseInt(contentLength, 10) : undefined
	let downloaded = 0

	const hash = createHash('sha256')
	const hashingStream = new Transform({
		transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
			hash.update(chunk)
			downloaded += chunk.length
			if (onProgress) {
				const percent =
					total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0
				onProgress(percent, downloaded, total)
			}
			callback(null, chunk)
		},
	})
	await pipeline(
		Readable.fromWeb(response.body as never),
		hashingStream,
		createWriteStream(destination, { flags: 'wx' }),
	)
	return hash.digest('hex')
}
