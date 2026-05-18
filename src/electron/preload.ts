import { contextBridge, ipcRenderer } from 'electron'
import {
	type MainRequestName,
	messageChannel,
	type RendererMessageName,
	requestChannel,
} from './ipc'

type Listener = (payload: unknown) => void

contextBridge.exposeInMainWorld('reviewerAgent', {
	request(name: MainRequestName, params: unknown) {
		return ipcRenderer.invoke(requestChannel(name), params)
	},
	addMessageListener(name: RendererMessageName, listener: Listener) {
		const channel = messageChannel(name)
		const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload)
		ipcRenderer.on(channel, wrapped)
		return () => ipcRenderer.removeListener(channel, wrapped)
	},
})
