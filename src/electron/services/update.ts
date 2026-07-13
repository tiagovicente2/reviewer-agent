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

export async function getUpdateStatus(): Promise<UpdateStatus> {
	const currentVersion = app.getVersion()

	try {
		const release = await getLatestRelease()

		return {
			currentVersion,
			latestVersion: release.version,
			latestUrl: release.htmlUrl,
			available: compareVersions(release.version, currentVersion) > 0,
			checking: false,
		}
	} catch (error) {
		return {
			currentVersion,
			available: false,
			checking: false,
			error: error instanceof Error ? error.message : 'Could not check for updates.',
		}
	}
}

export async function installUpdate(): Promise<UpdateResult> {
	let temporaryDirectory: string | undefined
	try {
		const release = await getLatestRelease()
		if (compareVersions(release.version, app.getVersion()) <= 0) {
			return { ok: false, message: 'No update is available.' }
		}

		const artifactName = getUpdateArtifactName(process.platform, process.arch)
		if (!artifactName) {
			return {
				ok: false,
				message: `Auto-update is not supported on ${process.platform}/${process.arch}.`,
			}
		}
		if (!release.assetNames.has(artifactName) || !release.assetNames.has(CHECKSUM_ASSET_NAME)) {
			return { ok: false, message: 'The release is missing a signed-off archive or checksum file.' }
		}

		const checksumManifest = await downloadText(
			getReleaseAssetUrl(release.tagName, CHECKSUM_ASSET_NAME),
		)
		const expectedChecksum = getExpectedChecksum(checksumManifest, artifactName)
		if (!expectedChecksum) {
			return { ok: false, message: `The checksum file does not include ${artifactName}.` }
		}

		temporaryDirectory = await mkdtemp(join(tmpdir(), 'reviewer-agent-update-'))
		const artifactPath = join(temporaryDirectory, artifactName)
		const actualChecksum = await downloadAndHash(
			getReleaseAssetUrl(release.tagName, artifactName),
			artifactPath,
		)
		if (actualChecksum !== expectedChecksum) {
			return { ok: false, message: `Checksum verification failed for ${artifactName}.` }
		}

		const command = getUpdateCommand(artifactPath)
		const result = await runUpdateInstaller(command)
		if (!result.ok) return result

		restartAppAfterUpdate()
		return { ok: true, message: 'Update installed. Restarting the app now.' }
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : 'Could not install the update.',
		}
	} finally {
		if (temporaryDirectory) await rm(temporaryDirectory, { force: true, recursive: true })
	}
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
				resolve({ ok: true, message: 'Update installed. Restarting the app now.' })
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

async function downloadAndHash(url: string, destination: string) {
	const response = await fetch(url)
	if (!response.ok || !response.body) {
		throw new Error(`Could not download update: GitHub returned ${response.status}.`)
	}

	const hash = createHash('sha256')
	const hashingStream = new Transform({
		transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
			hash.update(chunk)
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
