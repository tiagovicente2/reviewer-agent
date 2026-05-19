import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { StatusCard } from '@/components/common'
import { Button } from '@/components/ui'
import type { AgentAvailability, AppSettings, AvailablePiModel } from '@/shared/settings'
import { AgentStatusCard } from './AgentStatusCard'
import { PreferencesCard } from './PreferencesCard'
import { ReviewerInstructionsCard } from './ReviewerInstructionsCard'
import { UpdateStatusCard } from './UpdateStatusCard'

export function SettingsPage({
	onBack,
	onOpenErrorLog,
	onSaved,
}: {
	onBack: () => void
	onOpenErrorLog: () => void
	onSaved: (settings: AppSettings) => void
}) {
	const [settings, setSettings] = useState<AppSettings | null>(null)
	const [state, setState] = useState<AsyncState>('loading')
	const [error, setError] = useState('')
	const [availableModels, setAvailableModels] = useState<AvailablePiModel[]>([])
	const [agentAvailability, setAgentAvailability] = useState<AgentAvailability[]>([])
	const [agentsState, setAgentsState] = useState<AsyncState>('idle')
	const [instructionsMode, setInstructionsMode] = useState<'raw' | 'preview'>('raw')
	const instructionsModeInitializedRef = useRef(false)
	const { showToast } = useToast()

	useEffect(() => {
		let cancelled = false

		appRpc.request
			.getAppSettings()
			.then((value) => {
				if (cancelled) return
				setSettings(value)
				if (!instructionsModeInitializedRef.current) {
					setInstructionsMode(value.reviewerInstructions.trim() ? 'preview' : 'raw')
					instructionsModeInitializedRef.current = true
				}
				setState('idle')
			})
			.catch((unknownError: unknown) => {
				if (cancelled) return
				setError(getErrorMessage(unknownError))
				setState('error')
			})

		return () => {
			cancelled = true
		}
	}, [])

	const refreshAgentAvailability = useCallback(async () => {
		setAgentsState('loading')
		try {
			setAgentAvailability(await appRpc.request.listAgentAvailability())
			setAgentsState('idle')
		} catch {
			setAgentsState('error')
		}
	}, [])

	useEffect(() => {
		void refreshAgentAvailability()
	}, [refreshAgentAvailability])

	const codeAgent = settings?.codeAgent

	useEffect(() => {
		if (!codeAgent) return
		let cancelled = false
		setAvailableModels([])
		appRpc.request
			.listAvailablePiModels({ agent: codeAgent })
			.then((models) => {
				if (cancelled) return
				setAvailableModels(models)
				setSettings((current) => {
					if (!current || current.codeAgent !== codeAgent || models.length === 0) return current
					return models.some((availableModel) => availableModel.id === current.model)
						? current
						: { ...current, model: models[0]?.id ?? current.model }
				})
			})
			.catch(() => {
				if (!cancelled) setAvailableModels([])
			})

		return () => {
			cancelled = true
		}
	}, [codeAgent])

	const selectedAgentAvailability = settings
		? agentAvailability.find((agent) => agent.agent === settings.codeAgent)
		: undefined

	const save = async () => {
		if (!settings) return
		setState('loading')
		setError('')
		try {
			const saved = await appRpc.request.saveAppSettings(settings)
			setSettings(saved)
			onSaved(saved)
			setState('idle')
			showToast({ title: 'Settings saved', tone: 'success' })
		} catch (unknownError) {
			setError(getErrorMessage(unknownError))
			setState('error')
		}
	}

	return (
		<Box boxSizing="border-box" h="100%" overflow="hidden" px="8" py="6">
			<Stack gap="4" h="100%" minH="0" mx="auto" w="100%">
				<HStack alignItems="flex-start" justify="space-between">
					<Box>
						<Box as="h1" fontWeight="bold" textStyle="3xl">
							Settings
						</Box>
						<Box color="fg.muted" textStyle="sm">
							Configure local review generation.
						</Box>
					</Box>
					<HStack gap="2" flexShrink="0">
						<Button variant="outline" onClick={onOpenErrorLog}>
							Error log
						</Button>
						<Button variant="outline" onClick={onBack}>
							Back
						</Button>
						<Button loading={state === 'loading'} onClick={save} disabled={!settings}>
							Save
						</Button>
					</HStack>
				</HStack>

				{error ? <StatusCard tone="red" title="Could not save settings" body={error} /> : null}
				{settings ? (
					<Box
						display="grid"
						gap="4"
						gridTemplateColumns={{
							base: 'minmax(0, 1fr)',
							xl: '32rem minmax(0, 1fr)',
						}}
						h="100%"
						minH="0"
						overflow="hidden"
					>
						<Stack gap="4" h="100%" minH="0" overflowY="auto">
							<PreferencesCard
								availableModels={availableModels}
								onChange={setSettings}
								selectedAgentAvailability={selectedAgentAvailability}
								settings={settings}
							/>
							<AgentStatusCard
								agents={agentAvailability}
								agentsState={agentsState}
								onRefresh={() => void refreshAgentAvailability()}
							/>
							<UpdateStatusCard />
						</Stack>

						<ReviewerInstructionsCard
							instructions={settings.reviewerInstructions}
							mode={instructionsMode}
							onChangeInstructions={(reviewerInstructions) =>
								setSettings({ ...settings, reviewerInstructions })
							}
							onChangeMode={setInstructionsMode}
							path={settings.reviewerInstructionsPath}
						/>
					</Box>
				) : null}
			</Stack>
		</Box>
	)
}
