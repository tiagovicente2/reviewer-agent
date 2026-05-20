import { spawn } from 'node:child_process'
import { app } from 'electron'
import type { UpdateResult, UpdateStatus } from '@/shared/update'
import { compareVersions, normalizeVersion } from '@/shared/version'

const REPO = 'tiagovicente2/pr-review-agent'
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`
const INSTALL_SCRIPT_URL = `https://raw.githubusercontent.com/${REPO}/main/scripts/install.sh`
const INSTALL_SCRIPT_PS_URL = `https://raw.githubusercontent.com/${REPO}/main/scripts/install.ps1`

type GitHubLatestRelease = {
	tag_name?: string
	html_url?: string
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
	const currentVersion = app.getVersion()

	try {
		const response = await fetch(LATEST_RELEASE_API_URL, {
			headers: { Accept: 'application/vnd.github+json' },
		})
		if (!response.ok) throw new Error(`GitHub returned ${response.status}`)

		const release = (await response.json()) as GitHubLatestRelease
		const latestVersion = normalizeVersion(release.tag_name ?? '')
		if (!latestVersion) throw new Error('Latest release version is missing.')

		return {
			currentVersion,
			latestVersion,
			latestUrl: release.html_url,
			available: compareVersions(latestVersion, currentVersion) > 0,
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
	const status = await getUpdateStatus()
	if (status.error) return { ok: false, message: status.error }
	if (!status.available) return { ok: false, message: 'No update is available.' }

	const command = getUpdateCommand()
	if (!command) {
		return { ok: false, message: `Auto-update is not supported on ${process.platform}.` }
	}

	const child = spawn(command.command, command.args, {
		detached: true,
		stdio: 'ignore',
	})
	child.unref()

	setTimeout(() => app.quit(), 500)
	return { ok: true, message: 'Installing update. The app will close and can be reopened shortly.' }
}

function getUpdateCommand(): { command: string; args: string[] } | null {
	if (process.platform === 'win32') {
		return {
			command: 'powershell.exe',
			args: [
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-Command',
				`Start-Sleep -Seconds 1; irm '${INSTALL_SCRIPT_PS_URL}' | iex`,
			],
		}
	}

	if (process.platform === 'linux' || process.platform === 'darwin') {
		return {
			command: 'sh',
			args: ['-lc', `sleep 1; curl -fsSL '${INSTALL_SCRIPT_URL}' | bash`],
		}
	}

	return null
}
