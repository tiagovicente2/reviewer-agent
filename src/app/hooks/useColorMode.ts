import { useEffect, useState } from 'react'
import type { ColorModePreference } from '@/shared/settings'
import { appRpc } from '../rpc'
import type { ColorMode } from '../types'

export function useColorMode() {
	const [preference, setPreference] = useState<ColorModePreference>('system')
	const [systemColorMode, setSystemColorMode] = useState<ColorMode>('light')
	const colorMode: ColorMode = preference === 'system' ? systemColorMode : preference

	useEffect(() => {
		let cancelled = false
		const media = window.matchMedia('(prefers-color-scheme: dark)')
		const syncFromMediaQuery = () => setSystemColorMode(media.matches ? 'dark' : 'light')
		const syncFromNative = () => {
			appRpc.request
				.getSystemColorMode()
				.then((nativeColorMode) => {
					if (!cancelled) setSystemColorMode(nativeColorMode)
				})
				.catch(syncFromMediaQuery)
		}
		const handleNativeChange = ({ colorMode }: { colorMode: ColorMode }) =>
			setSystemColorMode(colorMode)

		syncFromNative()
		media.addEventListener('change', syncFromMediaQuery)
		appRpc.addMessageListener('systemColorModeChanged', handleNativeChange)
		return () => {
			cancelled = true
			media.removeEventListener('change', syncFromMediaQuery)
			appRpc.removeMessageListener('systemColorModeChanged', handleNativeChange)
		}
	}, [])

	useEffect(() => {
		document.documentElement.classList.toggle('dark', colorMode === 'dark')
		document.documentElement.classList.toggle('light', colorMode === 'light')
		document.documentElement.style.colorScheme = colorMode
	}, [colorMode])

	return { colorMode, preference, setPreference }
}
