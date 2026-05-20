import { join } from 'node:path'
import { app } from 'electron'

export function getHomePath() {
	return app.getPath('home') || process.env.HOME || process.env.USERPROFILE || process.cwd()
}

export function getUserDataPath() {
	return app.getPath('userData')
}

export function getLegacyDataDir() {
	const baseDir =
		process.env.XDG_DATA_HOME ??
		(process.env.HOME ? join(process.env.HOME, '.local', 'share') : join(process.cwd(), '.data'))
	return join(baseDir, 'reviewer-agent')
}

export function getLegacyConfigDir() {
	const baseDir =
		process.env.XDG_CONFIG_HOME ??
		(process.env.HOME ? join(process.env.HOME, '.config') : join(process.cwd(), '.config'))
	return join(baseDir, 'reviewer-agent')
}
