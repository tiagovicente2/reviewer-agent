import type { BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow) {
	mainWindow = window
}

export function minimizeWindow() {
	mainWindow?.minimize()
	return { ok: true as const }
}

export function toggleMaximizeWindow() {
	if (!mainWindow) {
		return { ok: true as const }
	}

	if (mainWindow.isMaximized()) {
		mainWindow.unmaximize()
	} else {
		mainWindow.maximize()
	}

	return { ok: true as const }
}

export function closeWindow() {
	mainWindow?.close()
	return { ok: true as const }
}
