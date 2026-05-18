import type { AppRPCSchema } from '@/shared/rpc'

export type MainRequestName = keyof AppRPCSchema['main']['requests']
export type RendererMessageName = keyof AppRPCSchema['renderer']['messages']

export type RequestDefinition<Name extends MainRequestName> = AppRPCSchema['main']['requests'][Name]
export type RequestParams<Name extends MainRequestName> = RequestDefinition<Name>['params']
export type RequestResponse<Name extends MainRequestName> = RequestDefinition<Name>['response']

export type RendererMessagePayload<Name extends RendererMessageName> =
	AppRPCSchema['renderer']['messages'][Name]

export const requestChannel = (name: MainRequestName) => `app:request:${String(name)}`
export const messageChannel = (name: RendererMessageName) => `app:message:${String(name)}`
