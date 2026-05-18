import type {
	MainRequestName,
	RendererMessageName,
	RendererMessagePayload,
	RequestParams,
	RequestResponse,
} from '@/electron/ipc'
import type { AppRPCSchema } from '@/shared/rpc'

type ElectronBridge = {
	request<Name extends MainRequestName>(
		name: Name,
		params: RequestParams<Name>,
	): Promise<RequestResponse<Name>>
	addMessageListener<Name extends RendererMessageName>(
		name: Name,
		listener: (payload: RendererMessagePayload<Name>) => void,
	): () => void
}

type MainRequests = AppRPCSchema['main']['requests']
type RequestApi = {
	[Name in keyof MainRequests]: MainRequests[Name]['params'] extends undefined
		? () => Promise<MainRequests[Name]['response']>
		: (params: MainRequests[Name]['params']) => Promise<MainRequests[Name]['response']>
}

const bridge = window.reviewerAgent

if (!bridge) {
	throw new Error('Electron bridge is not available.')
}

const listenerDisposers = new WeakMap<(...args: never[]) => void, () => void>()

export const appRpc = {
	request: new Proxy({} as RequestApi, {
		get(_target, property: string) {
			return (params?: unknown) => bridge.request(property as MainRequestName, params as never)
		},
	}),
	addMessageListener<Name extends RendererMessageName>(
		name: Name,
		listener: (payload: RendererMessagePayload<Name>) => void,
	) {
		listenerDisposers.set(
			listener as (...args: never[]) => void,
			bridge.addMessageListener(name, listener),
		)
	},
	removeMessageListener<Name extends RendererMessageName>(
		_name: Name,
		listener: (payload: RendererMessagePayload<Name>) => void,
	) {
		const dispose = listenerDisposers.get(listener as (...args: never[]) => void)
		dispose?.()
		listenerDisposers.delete(listener as (...args: never[]) => void)
	},
}

declare global {
	interface Window {
		reviewerAgent?: ElectronBridge
	}
}
