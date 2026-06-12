import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron'
import type { AppRPCSchema } from '@/shared/rpc'
import {
	type MainRequestName,
	messageChannel,
	type RendererMessageName,
	type RendererMessagePayload,
	requestChannel,
} from './ipc'
import { validateMainRequest } from './ipc-validation'
import { clearAppCache, getCacheStats } from './services/cache'
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
import { exportReviewToFile } from './services/review-export'
import { generateReview } from './services/review-generation'
import { getReviewGenerationJob, startReviewGeneration } from './services/review-generation-jobs'
import {
	publishReviewComment,
	publishReviewComments,
	submitReview,
} from './services/review-publish'
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
	getCacheStats,
	clearAppCache,
	installUpdate,
	getGitHubAuthStatus,
	startGitHubLogin,
	listGitHubReviewRequests,
	searchGitHubPullRequests,
	getGitHubPullRequestForReview,
	getGitHubPullRequestDetails,
	getGitHubPullRequestDiff,
	getGitHubAsset,
	generateReview,
	startReviewGeneration,
	getReviewGenerationJob,
	getSavedReview: getSavedGeneratedReview,
	exportReviewToFile,
	selectReviewExportDirectory,
	openExternalUrl,
	minimizeWindow,
	toggleMaximizeWindow,
	closeWindow,
	publishReviewComment,
	publishReviewComments,
	submitReview,
}

for (const [name, handler] of Object.entries(handlers) as [
	MainRequestName,
	Handlers[MainRequestName],
][]) {
	ipcMain.handle(requestChannel(name), (_event, params) => {
		validateMainRequest(name, params)
		return handler(params as never)
	})
}

async function createWindow() {
	const window = new BrowserWindow({
		title: 'Reviewer Agent',
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
			sandbox: true,
			webSecurity: true,
		},
	})

	setMainWindow(window)
	window.once('ready-to-show', () => window.show())
	window.webContents.setWindowOpenHandler(({ url }) => {
		void openExternalUrlIfSafe(url)
		return { action: 'deny' }
	})
	window.webContents.on('will-navigate', (event, url) => {
		if (isAllowedAppNavigation(url)) return
		event.preventDefault()
		void openExternalUrlIfSafe(url)
	})

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

async function selectReviewExportDirectory(params: {
	currentDirectory?: string
}): Promise<{ directory: string | null }> {
	const result = await dialog.showOpenDialog({
		defaultPath: params.currentDirectory || undefined,
		properties: ['openDirectory', 'createDirectory'],
		title: 'Select review export folder',
	})
	return { directory: result.canceled ? null : (result.filePaths[0] ?? null) }
}

async function openExternalUrlIfSafe(url: string) {
	try {
		await openExternalUrl({ url })
	} catch (error) {
		console.error('Blocked external navigation.', error)
	}
}

function isAllowedAppNavigation(url: string) {
	try {
		const targetUrl = new URL(url)
		return targetUrl.protocol === 'file:' || targetUrl.origin === DEV_SERVER_URL
	} catch {
		return false
	}
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
