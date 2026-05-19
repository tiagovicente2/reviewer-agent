import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, shell } from 'electron'
import type { AppRPCSchema } from '@/shared/rpc'
import {
	type MainRequestName,
	messageChannel,
	type RendererMessageName,
	type RendererMessagePayload,
	requestChannel,
} from './ipc'
import {
	getGitHubAsset,
	getGitHubAuthStatus,
	getGitHubPullRequestDetails,
	getGitHubPullRequestDiff,
	getGitHubPullRequestForReview,
	listGitHubReviewRequests,
	searchGitHubPullRequests,
	startGitHubLogin,
} from './services/github'
import { publishPiReviewComment, publishPiReviewComments } from './services/pi-publish'
import { generateReviewWithPi } from './services/pi-review'
import { getPiReviewGenerationJob, startPiReviewGeneration } from './services/pi-review-jobs'
import { getSavedGeneratedReview } from './services/review-store'
import {
	completeOnboarding,
	getAppSettings,
	listAgentAvailability,
	listAvailablePiModels,
	saveAppSettings,
} from './services/settings'
import { getUpdateStatus, installUpdate } from './services/update'
import {
	closeWindow,
	minimizeWindow,
	setMainWindow,
	toggleMaximizeWindow,
} from './services/window-controls'

const DEV_SERVER_URL = 'http://localhost:5173'
const isDev = !app.isPackaged
const preloadPath = fileURLToPath(new URL('./preload.cjs', import.meta.url))
const appIconPath = isDev
	? join(process.cwd(), 'assets', 'icon.png')
	: join(process.resourcesPath, 'assets', 'icon.png')

type MainRequests = AppRPCSchema['main']['requests']
type Handlers = {
	[Name in keyof MainRequests]: (
		params: MainRequests[Name]['params'],
	) => Promise<MainRequests[Name]['response']> | MainRequests[Name]['response']
}

const handlers: Handlers = {
	getAppSettings,
	saveAppSettings,
	completeOnboarding,
	listAvailablePiModels,
	listAgentAvailability,
	getSystemColorMode,
	getUpdateStatus,
	installUpdate,
	getGitHubAuthStatus,
	startGitHubLogin,
	listGitHubReviewRequests,
	searchGitHubPullRequests,
	getGitHubPullRequestForReview,
	getGitHubPullRequestDetails,
	getGitHubPullRequestDiff,
	getGitHubAsset,
	generateReviewWithPi,
	startPiReviewGeneration,
	getPiReviewGenerationJob,
	getSavedPiReview: getSavedGeneratedReview,
	openExternalUrl,
	minimizeWindow,
	toggleMaximizeWindow,
	closeWindow,
	publishPiReviewComment,
	publishPiReviewComments,
}

for (const [name, handler] of Object.entries(handlers) as [
	MainRequestName,
	Handlers[MainRequestName],
][]) {
	ipcMain.handle(requestChannel(name), (_event, params) => handler(params as never))
}

async function createWindow() {
	const window = new BrowserWindow({
		title: 'PR Review Agent',
		icon: appIconPath,
		backgroundColor: getWindowBackgroundColor(),
		show: false,
		width: 1280,
		height: 820,
		x: 120,
		y: 80,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
		},
	})

	setMainWindow(window)
	window.once('ready-to-show', () => window.show())

	if (isDev && (await canReachDevServer())) {
		await window.loadURL(DEV_SERVER_URL)
	} else {
		await window.loadFile(join(app.getAppPath(), 'dist', 'index.html'))
	}

	return window
}

app.whenReady().then(async () => {
	configureApplicationMenu()
	await createWindow()
	nativeTheme.on('updated', () =>
		sendToRenderers('systemColorModeChanged', { colorMode: getSystemColorMode() }),
	)
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) void createWindow()
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})

function configureApplicationMenu() {
	if (process.platform !== 'darwin') {
		Menu.setApplicationMenu(null)
		return
	}

	Menu.setApplicationMenu(
		Menu.buildFromTemplate([
			{
				label: app.name,
				submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
			},
			{
				label: 'Edit',
				submenu: [
					{ role: 'undo' },
					{ role: 'redo' },
					{ type: 'separator' },
					{ role: 'cut' },
					{ role: 'copy' },
					{ role: 'paste' },
					{ role: 'selectAll' },
				],
			},
		]),
	)
}

function getSystemColorMode(): 'dark' | 'light' {
	return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function getWindowBackgroundColor() {
	return nativeTheme.shouldUseDarkColors ? '#111113' : '#fcfcfd'
}

async function openExternalUrl(params: { url: string }): Promise<{ ok: true }> {
	const url = new URL(params.url)
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error('Only HTTP(S) URLs can be opened externally.')
	}
	await shell.openExternal(params.url)
	return { ok: true }
}

async function canReachDevServer() {
	try {
		await fetch(DEV_SERVER_URL, { method: 'HEAD' })
		return true
	} catch {
		return false
	}
}

function sendToRenderers<Name extends RendererMessageName>(
	name: Name,
	payload: RendererMessagePayload<Name>,
) {
	for (const window of BrowserWindow.getAllWindows()) {
		window.webContents.send(messageChannel(name), payload)
	}
}
